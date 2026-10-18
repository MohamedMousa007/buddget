'use client'

import { useEffect, useState } from 'react'
import { GoalAchievedScreen } from '@/components/features/goals/celebrate/GoalAchievedScreen'
import { MilestoneCheerSheet } from '@/components/features/goals/celebrate/MilestoneCheerSheet'
import { buildGoalProgressContext, computeGoalProgress } from '@/lib/goals/computeGoalProgress'
import { withDebtDerived } from '@/lib/goals/debtGoal'
import { CHECKPOINTS } from '@/lib/goals/goalDetail'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import type { Goal } from '@/lib/store/types'

const KEY = 'buddget-goal-checkpoints'

function load(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, number>
  } catch {
    return {}
  }
}
function save(m: Record<string, number>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(m))
  } catch {
    /* celebrations may repeat in a private window; harmless */
  }
}

interface Celebration {
  goal: Goal
  pct: number
  current: number
}

/**
 * Watches goal progress and celebrates a newly crossed checkpoint: a cheer sheet for 25/50/75%,
 * the full-screen screen at 100%. The first sighting of a goal only records where it already is.
 */
export function GoalCelebrationListener() {
  const [active, setActive] = useState<Celebration | null>(null)

  useEffect(() => {
    let last: unknown[] = []
    const check = () => {
      const st = useFinanceStore.getState()
      if (!st.dataReady) return
      const deps = [st.goals, st.savingsAccounts, st.debtPayments, st.settings]
      if (deps.every((d, i) => d === last[i])) return
      last = deps
      const ctx = buildGoalProgressContext(st, useSettingsStore.getState().monthFilter)
      const seen = load()
      let next: Celebration | null = null
      for (const stored of st.goals) {
        // Linked pockets/debts still loading: progress would read as 0 and then jump, a false celebration.
        if (!stored.linkedSavingsAccountIds.every((id) => st.savingsAccounts.some((a) => a.id === id))) continue
        if (!stored.linkedDebtIds.every((id) => st.debts.some((d) => d.id === id))) continue
        const goal = withDebtDerived(stored, ctx)
        if (goal.category === 'spending_control' || !((goal.targetAmount ?? 0) > 0)) continue
        const current = computeGoalProgress(stored, ctx)
        const pct = goal.status === 'achieved' ? 100 : (current / (goal.targetAmount as number)) * 100
        const level = [...CHECKPOINTS].reverse().find((c) => pct >= c) ?? 0
        const before = seen[goal.id]
        if (before !== undefined && level > before && !next) next = { goal, current, pct: level }
        if (before === undefined || level > before) seen[goal.id] = level
      }
      save(seen)
      if (next && st.settings.goalProgressAlerts !== false) setActive(next)
    }
    const first = setTimeout(check, 0)
    const unsub = useFinanceStore.subscribe(check)
    return () => {
      clearTimeout(first)
      unsub()
    }
  }, [])

  if (!active) return null
  const close = () => setActive(null)
  return active.pct >= 100 ? (
    <GoalAchievedScreen goal={active.goal} current={active.current} onClose={close} />
  ) : (
    <MilestoneCheerSheet goal={active.goal} pct={active.pct} current={active.current} onClose={close} />
  )
}
