'use client'

import { Fragment, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { goalHomes, homeSegment, type GoalHome } from '@/lib/goals/goalHomes'
import { useSavingsV9Copy } from '@/lib/i18n/savingsV9Copy'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { Goal } from '@/lib/store/types'
import { cn } from '@/lib/utils'
import { useMask } from '@/lib/privacy/useMask'

/** Where a goal's money sits, from the store. */
export function useGoalHomes(goal: Pick<Goal, 'id' | 'linkedSavingsAccountIds'>): GoalHome[] {
  const s = useFinanceStore(useShallow((st) => ({ accounts: st.savingsAccounts, methods: st.paymentMethods, base: st.settings.baseCurrency })))
  return useMemo(() => goalHomes(goal, s.accounts, s.methods, s.base), [goal, s.accounts, s.methods, s.base])
}

/** "$400 in Deel · 18 g gold · 12,000 in CIB": each home an isolated segment, so it never breaks or reorders in RTL. */
export function GoalHomesLine({ goal, className }: { goal: Pick<Goal, 'id' | 'linkedSavingsAccountIds'>; className?: string }) {
  const w = useSavingsV9Copy().goals
  const homes = useGoalHomes(goal)
  const hidden = useMask('lists')
  if (homes.length === 0 || hidden) return null
  return (
    <span className={cn('block text-xs leading-relaxed text-[var(--color-brand-text-secondary)]', className)}>
      {homes.map((h, i) => (
        <Fragment key={h.part.id}>
          {i > 0 ? <span aria-hidden> · </span> : null}
          <bdi className="inline-block whitespace-nowrap font-mono-numbers">{homeSegment(h, w)}</bdi>
        </Fragment>
      ))}
    </span>
  )
}
