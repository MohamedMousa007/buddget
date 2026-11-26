'use client'

import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { BAND_FG2, BAND_MIX, HeroBand } from '@/components/features/hero/HeroBand'
import { fitBigNumber } from '@/components/features/hero/fitText'
import type { GoalRow } from '@/hooks/useGoalRows'
import { intlTag } from '@/lib/i18n/dateFormat'
import { useLocale } from '@/lib/i18n'
import { useGoalsLtCopy } from '@/lib/i18n/goalsLtCopy'
import { fundingBasis } from '@/lib/goals/fundingBasis'
import { goalMonthlyRate } from '@/lib/goals/goalDetail'
import { MASK } from '@/lib/privacy/mask'
import { useMask } from '@/lib/privacy/useMask'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { convertCurrency } from '@/lib/utils/currency'
import { formatWhole } from '@/lib/utils/formatters'

const isSave = (r: GoalRow) => r.goal.category !== 'spending_control' && r.goal.category !== 'debt_freedom'

/** Saved for goals: what the running saving goals hold, how far along they are together, the monthly pace and the next finish. */
export function GoalsHero({ rows }: { rows: GoalRow[] }) {
  const c = useGoalsLtCopy().goals
  const hidden = useMask('hero')
  const { locale } = useLocale()
  const s = useFinanceStore(
    useShallow((st) => ({
      incomeEvents: st.incomeEvents, incomeSources: st.incomeSources, expenses: st.expenses,
      budgetCategories: st.budgetCategories, budgetPlans: st.budgetPlans, activeBudgetPlanId: st.activeBudgetPlanId,
      exchangeRates: st.exchangeRates, settings: st.settings,
    })),
  )
  const base = s.settings.baseCurrency
  const sum = useMemo(() => {
    const now = new Date()
    const keep = fundingBasis(s, now).usualKeep
    const save = rows.filter((r) => isSave(r) && r.goal.status !== 'achieved')
    const toBase = (n: number, from: string) => convertCurrency(n, from, base, s.exchangeRates)
    const saved = save.reduce((a, r) => a + toBase(r.current, r.goal.currency), 0)
    const want = save.reduce((a, r) => a + toBase(r.goal.targetAmount ?? 0, r.goal.currency), 0)
    const monthly = save
      .filter((r) => r.goal.status === 'active')
      .reduce((a, r) => {
        const keepInGoal = keep === null ? null : convertCurrency(keep, base, r.goal.currency, s.exchangeRates)
        return a + toBase(goalMonthlyRate(r.goal, keepInGoal) ?? 0, r.goal.currency)
      }, 0)
    const next = save.filter((r) => r.goal.status === 'active' && r.goal.targetDate).map((r) => r.goal.targetDate!).sort()[0] ?? null
    return { saved, want, monthly, next }
  }, [rows, s, base])

  const pct = sum.want > 0 ? Math.min(100, Math.round((sum.saved / sum.want) * 100)) : 0
  const total = formatWhole(sum.saved)
  const next = sum.next
    ? new Date(`${sum.next.slice(0, 7)}-01T00:00:00`).toLocaleDateString(intlTag(locale), { month: 'short', year: 'numeric' })
    : null

  return (
    <HeroBand
      contained
      label={c.savedLabel}
      numbers={
        <>
          <p className="flex min-w-0 items-baseline gap-1.5">
            <span className={`shrink-0 font-mono-numbers font-semibold leading-none tracking-[-0.03em] ${hidden ? 'text-[32px]' : fitBigNumber(total)}`}>{hidden ? MASK : total}</span>
            <span className={`min-w-0 truncate text-[0.8125rem] ${BAND_FG2}`}>{base}</span>
          </p>
          {sum.want > 0 ? (
            <p className={`shrink-0 text-end text-[0.71875rem] leading-[1.3] ${BAND_FG2}`}>
              <b className="block font-mono-numbers text-[0.9375rem] text-[var(--flow-band-fg)]">{c.pctThere(pct)}</b>
              {hidden ? MASK : c.ofAll(formatWhole(sum.want))}
            </p>
          ) : null}
        </>
      }
      bar={
        <div className="h-1.5 overflow-hidden rounded-full" style={{ background: BAND_MIX }}>
          <span className="block h-full rounded-full bg-[var(--flow-band-fg)]" style={{ width: `${pct}%` }} />
        </div>
      }
      note={
        sum.monthly > 0 || next ? (
          <span className="flex flex-wrap gap-x-4 font-mono-numbers">
            {sum.monthly > 0 ? <span><b className="font-semibold text-[var(--flow-band-fg)]">{hidden ? MASK : c.aMonth(formatWhole(sum.monthly))}</b></span> : null}
            {next ? <span>{c.nextFinish(next)}</span> : null}
          </span>
        ) : undefined
      }
    />
  )
}
