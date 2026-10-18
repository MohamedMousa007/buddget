'use client'

import { useMemo, useState } from 'react'
import { CounselorCard } from '@/components/features/goals/new/CounselorCard'
import { DateStepper } from '@/components/features/goals/new/DateStepper'
import { SplitSavingsSheet } from '@/components/features/goals/SplitSavingsSheet'
import { StepFundIt } from '@/components/features/goals/new/StepFundIt'
import { SheetFrame } from '@/components/features/subscriptions/SheetFrame'
import { AmountField } from '@/components/ui/AmountField'
import { Button } from '@/components/ui/button'
import { OptionChip } from '@/components/ui/OptionChip'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { fundingBasis } from '@/lib/goals/fundingBasis'
import { computePace } from '@/lib/goals/goalPlan'
import { useT } from '@/lib/i18n'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { Goal, GoalFrequency, GoalFundingMode } from '@/lib/store/types'
import { convertCurrency } from '@/lib/utils/currency'
import { useShallow } from 'zustand/react/shallow'

export type PlanEditorKind = 'finish' | 'funding' | 'pocket'

const num = (s: string) => (Number.isFinite(parseFloat(s)) ? parseFloat(s) : 0)
const FIELD = 'h-[52px] rounded-[14px] bg-[var(--color-brand-elevated)]'

/** One sheet, three editors: finish line (date, target, pace), funding mode, linked pockets. */
export function PlanEditorSheet({ goal, kind, current, onClose }: { goal: Goal; kind: PlanEditorKind; current: number; onClose: () => void }) {
  const t = useT()
  const s = useFinanceStore(
    useShallow((st) => ({
      incomeEvents: st.incomeEvents, incomeSources: st.incomeSources, expenses: st.expenses,
      budgetCategories: st.budgetCategories, budgetPlans: st.budgetPlans, exchangeRates: st.exchangeRates,
      settings: st.settings, goals: st.goals, savingsAccounts: st.savingsAccounts, debts: st.debts,
    })),
  )
  const now = useMemo(() => new Date(), [])
  const today = now.toISOString().slice(0, 10)
  const basis = useMemo(() => fundingBasis(s, now), [s, now])
  const usualKeep = basis.usualKeep === null ? null : convertCurrency(basis.usualKeep, s.settings.baseCurrency, goal.currency, s.exchangeRates)

  const [date, setDate] = useState(goal.targetDate ?? `${now.getFullYear() + 1}-01-01`)
  const [target, setTarget] = useState(String(goal.targetAmount ?? ''))
  const [freq, setFreq] = useState<GoalFrequency>(goal.frequency)
  const [mode, setMode] = useState<GoalFundingMode>(goal.fundingMode)
  const [share, setShare] = useState(goal.sharePct ?? 100)
  const [fixed, setFixed] = useState(goal.monthlyContribution ? String(goal.monthlyContribution) : '')
  const [split, setSplit] = useState(false)
  const [sav, setSav] = useState(goal.linkedSavingsAccountIds)
  const [debtIds, setDebtIds] = useState(goal.linkedDebtIds)

  const pace = useMemo(
    () => computePace({ target: num(target), saved: current, targetDate: date, frequency: freq, usualKeep, now }),
    [target, current, date, freq, usualKeep, now],
  )
  const otherShare = s.goals.filter((g) => g.id !== goal.id && g.status === 'active' && g.fundingMode === 'share').reduce((a, g) => a + (g.sharePct ?? 0), 0)
  const upd = useFinanceStore((st) => st.updateGoal)
  const toggle = (list: string[], set: (v: string[]) => void, id: string) => set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id])

  const save = () => {
    if (kind === 'finish') upd(goal.id, { targetDate: date, targetAmount: num(target), frequency: freq, planStart: today })
    else if (kind === 'funding')
      upd(goal.id, {
        fundingMode: mode,
        sharePct: mode === 'share' ? share : null,
        monthlyContribution: mode === 'fixed' && num(fixed) > 0 ? num(fixed) : null,
        planStart: today,
      })
    else upd(goal.id, goal.category === 'debt_freedom' ? { linkedDebtIds: debtIds } : { linkedSavingsAccountIds: sav })
    onClose()
  }

  const title = kind === 'finish' ? t.goals.detail.finishTitle : kind === 'funding' ? t.goals.detail.fundingTitle : t.goals.detail.pocketTitle
  const f = t.goals.flow

  return (
    <SheetFrame
      open
      onClose={onClose}
      title={title}
      zClassName="z-[110]"
      footer={<Button size="cta-block" onClick={save}>{t.goals.detail.editSave}</Button>}
    >
      {kind === 'finish' ? (
        <>
          <DateStepper value={date} now={now} onChange={setDate} />
          <AmountField value={target} onChange={setTarget} currency={goal.currency} className={FIELD} aria-label={f.s2.target} />
          <SegmentedControl<GoalFrequency>
            ariaLabel={f.s2.save}
            size="field"
            value={freq}
            onChange={setFreq}
            options={[{ value: 'monthly', label: f.s2.monthly }, { value: 'quarterly', label: f.s2.quarterly }]}
          />
          <CounselorCard
            pace={pace}
            usualKeep={usualKeep}
            frequency={freq}
            currency={goal.currency}
            targetDate={date}
            onUseDate={setDate}
            onUseTarget={(n) => setTarget(String(n))}
          />
        </>
      ) : kind === 'funding' ? (
        <StepFundIt
          existing
          onOpenSplit={() => setSplit(true)}
          form={{
            fundingMode: mode, setFundingMode: setMode, sharePct: share, setSharePct: setShare,
            fixedAmount: fixed, setFixedAmount: setFixed, currency: goal.currency, frequency: goal.frequency,
            basis, usualKeep, otherShare, name: goal.name, targetAmount: target, alreadySaved: String(current), now,
          }}
        />
      ) : goal.category === 'debt_freedom' ? (
        <div className="flex flex-wrap gap-2">
          {s.debts.filter((d) => d.status !== 'cleared').map((d) => (
            <OptionChip key={d.id} size="sm" selected={debtIds.includes(d.id)} onClick={() => toggle(debtIds, setDebtIds, d.id)}>
              {d.name}
            </OptionChip>
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {s.savingsAccounts.filter((a) => a.category === 'savings').map((a) => (
            <OptionChip key={a.id} size="sm" selected={sav.includes(a.id)} onClick={() => toggle(sav, setSav, a.id)} className="max-w-full truncate">
              {a.name}
            </OptionChip>
          ))}
        </div>
      )}
      {split ? <SplitSavingsSheet onClose={() => setSplit(false)} /> : null}
    </SheetFrame>
  )
}
