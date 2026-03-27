'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Check, Target } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import type { ExpenseCategory, OnboardingAiPlan } from '@/lib/store/types'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MoneyDisplay } from '@/components/ui/MoneyDisplay'
import { normalizeCategoryPercents } from '@/lib/onboarding/planNormalization'
import { calculateMonthlyIncome } from '@/lib/utils/calculations'
import { useFinanceStore } from '@/lib/store/useFinanceStore'

const CATS: ExpenseCategory[] = [
  'Rent',
  'Transport',
  'Food',
  'Enjoyment',
  'Savings',
  'Debt',
  'Remittance',
  'Other',
]

function shortLine(s: string, max: number): string {
  const t = s.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1).trim()}…`
}

export function OnboardingPlanPicker({
  plans,
  validationNotes,
  busy,
  onAccept,
}: {
  plans: OnboardingAiPlan[]
  validationNotes: string[]
  busy: boolean
  onAccept: (plan: OnboardingAiPlan) => void
}) {
  const [idx, setIdx] = useState(0)
  const [edited, setEdited] = useState<Record<ExpenseCategory, number> | null>(null)

  const { incomeSources, settings, exchangeRates } = useFinanceStore(
    useShallow((s) => ({
      incomeSources: s.incomeSources,
      settings: s.settings,
      exchangeRates: s.exchangeRates,
    }))
  )

  const monthlyTakeHome = useMemo(
    () => calculateMonthlyIncome(incomeSources, settings.baseCurrency, exchangeRates),
    [incomeSources, settings.baseCurrency, exchangeRates]
  )

  const plan = plans[idx]
  const percents = useMemo(() => {
    if (!plan) return null
    return edited ?? plan.percents
  }, [plan, edited])

  if (!plan || !percents) return null

  const setPct = (c: ExpenseCategory, v: string) => {
    const n = parseFloat(v.replace(/,/g, '.'))
    if (!Number.isFinite(n)) return
    const clamped = Math.max(0, Math.min(100, n))
    const base = edited ?? { ...plan.percents }
    const next = { ...base, [c]: clamped }
    setEdited(normalizeCategoryPercents(next as Record<string, number>))
  }

  const setAmt = (c: ExpenseCategory, v: string) => {
    const n = parseFloat(v.replace(/,/g, '.'))
    if (!Number.isFinite(n) || n < 0) return
    if (monthlyTakeHome <= 0) return
    const newPct = (n / monthlyTakeHome) * 100
    const base = edited ?? { ...plan.percents }
    const next = { ...base, [c]: newPct }
    setEdited(normalizeCategoryPercents(next as Record<string, number>))
  }

  const acceptPayload: OnboardingAiPlan = edited ? { ...plan, percents: edited } : plan

  const note = validationNotes.find((n) => n.trim().length > 0)

  return (
    <div className="glass-card rounded-2xl p-6 w-full max-w-4xl flex flex-col gap-6 self-center">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="space-y-2 min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-wider text-[var(--color-brand-text-muted)]">
            Plan {idx + 1} / {plans.length}
          </p>
          <div className="flex items-start gap-2">
            <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--color-brand-red)]/15 text-[var(--color-brand-red)] shrink-0">
              <Target className="w-4 h-4" aria-hidden />
            </span>
            <div>
              <h2 className="text-xl font-bold text-white font-heading leading-tight">{plan.label}</h2>
              <p className="text-sm text-[var(--color-brand-red)] font-medium mt-0.5">{plan.personaLabel}</p>
              <p className="text-xs text-[var(--color-brand-text-secondary)] mt-1">{plan.personaTagline}</p>
            </div>
          </div>
          {plan.rationale ? (
            <p className="text-sm text-[var(--color-brand-text-secondary)] leading-snug">
              {shortLine(plan.rationale, 160)}
            </p>
          ) : null}
        </div>

        <div className="rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]/50 px-4 py-3 shrink-0 lg:min-w-[220px]">
          <p className="text-[10px] uppercase tracking-wider text-[var(--color-brand-text-muted)] mb-1">
            Monthly take-home
          </p>
          <MoneyDisplay
            variant="card"
            amount={monthlyTakeHome}
            currency={settings.baseCurrency}
            primaryClassName="text-lg font-semibold text-white"
            secondaryClassName="text-[11px]"
          />
        </div>
      </div>

      {note ? (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-100/95">
          {shortLine(note, 200)}
        </div>
      ) : null}

      {plan.costOfLivingNote ? (
        <p className="text-[11px] text-[var(--color-brand-text-muted)] border-l-2 border-[var(--color-brand-red)]/50 pl-3">
          {shortLine(plan.costOfLivingNote, 140)}
        </p>
      ) : null}

      <div>
        <p className="text-xs font-medium text-white mb-3">Where your money goes</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {CATS.map((c) => {
            const pct = percents[c] ?? 0
            const amt = monthlyTakeHome > 0 ? (monthlyTakeHome * pct) / 100 : 0
            return (
              <div
                key={c}
                className="rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]/35 p-3 flex flex-col gap-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-white font-medium">{c}</span>
                  <div className="flex items-center gap-1">
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={String(pct)}
                      onChange={(e) => setPct(c, e.target.value)}
                      className="w-14 h-8 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white font-mono-numbers text-xs px-2"
                    />
                    <span className="text-[var(--color-brand-text-muted)] text-xs">%</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Label className="text-[10px] text-[var(--color-brand-text-muted)] shrink-0">Amount ({settings.baseCurrency})</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    disabled={monthlyTakeHome <= 0}
                    value={monthlyTakeHome > 0 ? String(Math.round(amt * 100) / 100) : ''}
                    onChange={(e) => setAmt(c, e.target.value)}
                    placeholder={monthlyTakeHome <= 0 ? 'Add income first' : '0'}
                    className="flex-1 min-w-[6rem] h-8 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white font-mono-numbers text-xs px-2"
                  />
                </div>
              </div>
            )
          })}
        </div>
        <p className="text-[10px] text-[var(--color-brand-text-muted)] mt-2">
          Edit percentages or amounts (amounts use your monthly take-home). Values are normalized to ~100% when you
          accept.
        </p>
      </div>

      {plan.assumptions.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {plan.assumptions.slice(0, 2).map((a) => (
            <span
              key={a}
              className="inline-flex items-center rounded-full border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]/60 px-3 py-1 text-[11px] text-[var(--color-brand-text-secondary)]"
            >
              {shortLine(a, 90)}
            </span>
          ))}
        </div>
      ) : null}

      <div className="flex flex-col sm:flex-row gap-2">
        <button
          type="button"
          disabled={idx <= 0 || busy}
          onClick={() => {
            setEdited(null)
            setIdx((i) => i - 1)
          }}
          className="flex-1 py-2.5 rounded-xl border border-[var(--color-brand-border)] text-sm text-white disabled:opacity-40 flex items-center justify-center gap-1"
        >
          <ChevronLeft className="w-4 h-4" />
          Previous
        </button>
        <button
          type="button"
          disabled={idx >= plans.length - 1 || busy}
          onClick={() => {
            setEdited(null)
            setIdx((i) => i + 1)
          }}
          className="flex-1 py-2.5 rounded-xl border border-[var(--color-brand-border)] text-sm text-white disabled:opacity-40 flex items-center justify-center gap-1"
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={() => onAccept({ ...acceptPayload, percents: normalizeCategoryPercents(acceptPayload.percents) })}
        className="w-full py-3 rounded-xl bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {busy ? 'Saving…' : 'Use this plan'}
        <Check className="w-4 h-4" />
      </button>
    </div>
  )
}
