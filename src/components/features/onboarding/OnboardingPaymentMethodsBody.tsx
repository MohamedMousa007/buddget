'use client'

import { useLayoutEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import type { SurveyStep } from '@/lib/onboarding/surveyConfig'
import type { OnboardingPaymentDraft, PaymentMethodType } from '@/lib/store/types'

export interface OnboardingPaymentMethodsBodyProps {
  step: Extract<SurveyStep, { type: 'payment_methods' }>
  initialDrafts: OnboardingPaymentDraft[]
  onChange: (d: OnboardingPaymentDraft[]) => void
}

/**
 * Checkbox grid + nicknames for payment method onboarding step.
 */
export function OnboardingPaymentMethodsBody({
  step,
  initialDrafts,
  onChange,
}: OnboardingPaymentMethodsBodyProps) {
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
              placeholder="Give it a nickname (e.g. Work debit)"
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
              placeholder="Your custom method name"
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
          + Add your own method
        </button>
      </div>
    </div>
  )
}
