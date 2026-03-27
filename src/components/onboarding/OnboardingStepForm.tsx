'use client'

import { useLayoutEffect, useMemo, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { motion } from 'framer-motion'
import type { SurveyStep } from '@/lib/onboarding/surveyConfig'
import type { Currency, IncomeSource, OnboardingPaymentDraft, PaymentMethodType } from '@/lib/store/types'
import { Input } from '@/components/ui/input'
import {
  IncomeOnboardingPanel,
  type IncomeOnboardingPayload,
} from '@/components/onboarding/IncomeOnboardingPanel'
import { DebtOnboardingPanel, type DebtOnboardingPayload } from '@/components/onboarding/DebtOnboardingPanel'
import {
  SubscriptionsOnboardingPanel,
  subscriptionLinesFromSaved,
  type SubscriptionsOnboardingPayload,
} from '@/components/onboarding/SubscriptionsOnboardingPanel'

export type StepContinuePayload =
  | { kind: 'static' }
  | { kind: 'text'; textValue: string }
  | { kind: 'number'; textValue: string }
  | { kind: 'single'; selected: string }
  | { kind: 'multi'; values: string[] }
  | { kind: 'payment'; drafts: OnboardingPaymentDraft[] }
  | { kind: 'income'; payload: IncomeOnboardingPayload }
  | { kind: 'debt'; payload: DebtOnboardingPayload }
  | { kind: 'subscriptions'; payload: SubscriptionsOnboardingPayload }

function PaymentMethodsBody({
  step,
  initialDrafts,
  onChange,
}: {
  step: Extract<SurveyStep, { type: 'payment_methods' }>
  initialDrafts: OnboardingPaymentDraft[]
  onChange: (d: OnboardingPaymentDraft[]) => void
}) {
  const [customRows, setCustomRows] = useState<{ nickname: string }[]>(() => {
    const fromInitial = initialDrafts.filter(
      (d) => d.preset.startsWith('custom_') || (d.type === 'other' && !step.options.some((o) => o.value === d.preset))
    )
    return fromInitial.length ? fromInitial.map((d) => ({ nickname: d.nickname })) : []
  })

  const [checked, setChecked] = useState<Record<string, boolean>>(() => {
    const m: Record<string, boolean> = {}
    for (const o of step.options) m[o.value] = initialDrafts.some((d) => d.preset === o.value)
    return m
  })

  const [nicknames, setNicknames] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {}
    for (const o of step.options) {
      const hit = initialDrafts.find((d) => d.preset === o.value)
      m[o.value] = hit?.nickname ?? (o.value === 'cash' ? 'Cash' : o.label)
    }
    return m
  })

  const emit = (nextChecked = checked, nextNick = nicknames, nextCustom = customRows) => {
    const out: OnboardingPaymentDraft[] = []
    for (const o of step.options) {
      if (!nextChecked[o.value]) continue
      out.push({
        preset: o.value,
        type: o.methodType as PaymentMethodType,
        nickname: (nextNick[o.value] || o.label).trim() || o.label,
      })
    }
    nextCustom.forEach((row, i) => {
      const n = row.nickname.trim()
      if (!n) return
      out.push({
        preset: `custom_${i}`,
        type: 'other',
        nickname: n,
      })
    })
    onChange(out)
  }

  useLayoutEffect(() => {
    emit()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync initial selection to parent once per mount
  }, [])

  return (
    <div className="grid gap-3">
      {step.options.map((o) => (
        <div
          key={o.value}
          className="rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]/60 p-3 space-y-2"
        >
          <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
            <input
              type="checkbox"
              checked={!!checked[o.value]}
              onChange={(e) => {
                const next = { ...checked, [o.value]: e.target.checked }
                setChecked(next)
                emit(next, nicknames, customRows)
              }}
              className="rounded border-[var(--color-brand-border)]"
            />
            {o.label}
          </label>
          {checked[o.value] ? (
            <Input
              placeholder="Nickname (e.g. Work debit)"
              value={nicknames[o.value] ?? ''}
              onChange={(e) => {
                const next = { ...nicknames, [o.value]: e.target.value }
                setNicknames(next)
                emit(checked, next, customRows)
              }}
              className="bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white text-sm"
            />
          ) : null}
        </div>
      ))}
      <div className="space-y-2">
        {customRows.map((row, i) => (
          <div key={i} className="flex gap-2">
            <Input
              placeholder="Custom method name"
              value={row.nickname}
              onChange={(e) => {
                const next = [...customRows]
                next[i] = { nickname: e.target.value }
                setCustomRows(next)
                emit(checked, nicknames, next)
              }}
              className="flex-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white text-sm"
            />
            <button
              type="button"
              className="text-xs text-[var(--color-brand-text-muted)] px-2"
              onClick={() => {
                const next = customRows.filter((_, j) => j !== i)
                setCustomRows(next)
                emit(checked, nicknames, next)
              }}
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => {
            const next = [...customRows, { nickname: '' }]
            setCustomRows(next)
            emit(checked, nicknames, next)
          }}
          className="text-xs text-[var(--color-brand-red)] hover:underline"
        >
          + Add my own method
        </button>
      </div>
    </div>
  )
}

export function OnboardingStepForm({
  step,
  initialText,
  initialSelected,
  initialMulti,
  initialPaymentDrafts,
  initialIncomeEntries,
  initialDebtEntries,
  initialSubscriptionRaw,
  baseCurrency,
  loadError,
  isLastSurveyStep,
  finishing,
  planLoading,
  onContinue,
}: {
  step: SurveyStep
  initialText: string
  initialSelected: string | null
  initialMulti: string[]
  initialPaymentDrafts: OnboardingPaymentDraft[]
  initialIncomeEntries: Omit<IncomeSource, 'id' | 'createdAt'>[]
  initialDebtEntries: DebtOnboardingPayload['entries']
  initialSubscriptionRaw: unknown
  baseCurrency: Currency
  loadError: string | null
  isLastSurveyStep: boolean
  finishing: boolean
  planLoading: boolean
  onContinue: (payload: StepContinuePayload) => void | Promise<void>
}) {
  const [textValue, setTextValue] = useState(initialText)
  const [selected, setSelected] = useState<string | null>(initialSelected)
  const [multi, setMulti] = useState<string[]>(initialMulti)
  const [paymentDrafts, setPaymentDrafts] = useState<OnboardingPaymentDraft[]>(initialPaymentDrafts)
  const [incomePayload, setIncomePayload] = useState<IncomeOnboardingPayload>(() => ({
    entries: initialIncomeEntries,
  }))
  const [debtPayload, setDebtPayload] = useState<DebtOnboardingPayload>(() => ({
    entries: initialDebtEntries,
  }))
  const [subscriptionsPayload, setSubscriptionsPayload] = useState<SubscriptionsOnboardingPayload>(() => ({
    lines: subscriptionLinesFromSaved(initialSubscriptionRaw, baseCurrency),
  }))

  const canContinue = useMemo(() => {
    if (step.type === 'static') return true
    if (step.type === 'text') return textValue.trim().length > 0
    if (step.type === 'number') {
      const raw = textValue.replace(/,/g, '.').replace(/\.(?=.*\.)/g, '')
      const n = parseFloat(raw)
      const min = step.min ?? 0
      const max = step.max
      if (!Number.isFinite(n) || n < min) return false
      if (max != null && n > max) return false
      return true
    }
    if (step.type === 'single_select') return !!selected
    if (step.type === 'multi_select') {
      const min = step.minSelections ?? 1
      const max = step.maxSelections ?? 99
      return multi.length >= min && multi.length <= max
    }
    if (step.type === 'payment_methods') {
      return paymentDrafts.length > 0 && paymentDrafts.every((d) => d.nickname.trim().length > 0)
    }
    if (step.type === 'income_entry' || step.type === 'debt_entry' || step.type === 'subscriptions_detail') {
      return true
    }
    return false
  }, [step, textValue, selected, multi, paymentDrafts])

  const toggleMulti = (value: string) => {
    setMulti((prev) => {
      const max = step.type === 'multi_select' ? step.maxSelections ?? 99 : 99
      if (prev.includes(value)) return prev.filter((v) => v !== value)
      if (prev.length >= max) return prev
      return [...prev, value]
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -24 }}
      transition={{ duration: 0.2 }}
      className={`glass-card rounded-2xl p-6 w-full flex flex-col gap-5 self-center ${
        step.type === 'income_entry' || step.type === 'debt_entry' || step.type === 'subscriptions_detail'
          ? 'max-w-2xl'
          : 'max-w-lg'
      }`}
    >
      <div>
        <h2 className="text-xl font-bold text-white font-heading mb-1">{step.title}</h2>
        {'subtitle' in step && step.subtitle ? (
          <p className="text-xs text-[var(--color-brand-text-secondary)] mb-2">{step.subtitle}</p>
        ) : null}
        {loadError ? (
          <p className="text-[11px] text-amber-200/90 mb-2">
            Could not load remote survey ({loadError}). Using built-in expert flow.
          </p>
        ) : null}
        {'helpText' in step && step.helpText ? (
          <p className="text-[11px] text-[var(--color-brand-text-muted)] leading-relaxed">{step.helpText}</p>
        ) : null}
      </div>

      {step.type === 'static' ? (
        <p className="text-sm text-[var(--color-brand-text-secondary)] leading-relaxed">{step.body}</p>
      ) : null}
      {step.type === 'text' ? (
        <Input
          value={textValue}
          maxLength={step.maxLength ?? 120}
          placeholder={step.placeholder ?? ''}
          onChange={(e) => setTextValue(e.target.value)}
          className="bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white"
        />
      ) : null}
      {step.type === 'number' ? (
        <Input
          type="text"
          inputMode="decimal"
          value={textValue}
          placeholder={step.placeholder ?? ''}
          onChange={(e) => setTextValue(e.target.value.replace(/[^\d.,]/g, ''))}
          className="bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white font-mono-numbers"
        />
      ) : null}
      {step.type === 'single_select' ? (
        <div className="grid gap-2">
          {step.options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setSelected(opt.value)}
              className={`w-full text-left rounded-xl border px-4 py-3 text-sm transition-colors ${
                selected === opt.value
                  ? 'border-[var(--color-brand-red)] bg-[var(--color-brand-red)]/10 text-white'
                  : 'border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-secondary)] hover:border-[var(--color-brand-red)]/40'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      ) : null}
      {step.type === 'multi_select' ? (
        <div className="grid gap-2">
          {step.options.map((opt) => {
            const on = multi.includes(opt.value)
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggleMulti(opt.value)}
                className={`w-full text-left rounded-xl border px-4 py-3 text-sm transition-colors ${
                  on
                    ? 'border-[var(--color-brand-red)] bg-[var(--color-brand-red)]/10 text-white'
                    : 'border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-secondary)] hover:border-[var(--color-brand-red)]/40'
                }`}
              >
                {opt.label}
              </button>
            )
          })}
          <p className="text-[10px] text-[var(--color-brand-text-muted)]">
            Selected {multi.length}
            {step.minSelections != null ? ` (min ${step.minSelections})` : ''}
            {step.maxSelections != null ? ` · max ${step.maxSelections}` : ''}
          </p>
        </div>
      ) : null}
      {step.type === 'payment_methods' ? (
        <PaymentMethodsBody step={step} initialDrafts={initialPaymentDrafts} onChange={setPaymentDrafts} />
      ) : null}
      {step.type === 'income_entry' ? (
        <IncomeOnboardingPanel entries={incomePayload.entries} onChange={setIncomePayload} />
      ) : null}
      {step.type === 'debt_entry' ? (
        <DebtOnboardingPanel entries={debtPayload.entries} onChange={setDebtPayload} />
      ) : null}
      {step.type === 'subscriptions_detail' ? (
        <SubscriptionsOnboardingPanel
          lines={subscriptionsPayload.lines}
          baseCurrency={baseCurrency}
          onChange={setSubscriptionsPayload}
        />
      ) : null}

      <button
        type="button"
        disabled={!canContinue || finishing || planLoading}
        onClick={() => {
          if (step.type === 'static') void onContinue({ kind: 'static' })
          else if (step.type === 'text') void onContinue({ kind: 'text', textValue })
          else if (step.type === 'number') void onContinue({ kind: 'number', textValue })
          else if (step.type === 'single_select') {
            if (selected) void onContinue({ kind: 'single', selected })
          } else if (step.type === 'multi_select') void onContinue({ kind: 'multi', values: multi })
          else if (step.type === 'payment_methods') void onContinue({ kind: 'payment', drafts: paymentDrafts })
          else if (step.type === 'income_entry') void onContinue({ kind: 'income', payload: incomePayload })
          else if (step.type === 'debt_entry') void onContinue({ kind: 'debt', payload: debtPayload })
          else if (step.type === 'subscriptions_detail')
            void onContinue({ kind: 'subscriptions', payload: subscriptionsPayload })
        }}
        className="w-full py-3 rounded-xl bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {planLoading ? 'Building plans…' : finishing ? 'Finishing…' : isLastSurveyStep ? 'Continue' : 'Continue'}
        {!finishing && !planLoading ? <ChevronRight className="w-4 h-4" /> : null}
      </button>
    </motion.div>
  )
}
