'use client'

import { useState } from 'react'
import { Target } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { PromptBanner } from '@/components/ui/PromptBanner'
import { useT } from '@/lib/i18n'
import { trackedDebtIds } from '@/lib/goals/debtGoal'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { clampFiatToAllowed } from '@/lib/utils/currencyPickerOptions'

const KEY = 'buddget-debt-goal-dismissed'

function dismissed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[]
  } catch {
    return []
  }
}

/** On the Debts page: offers to follow an untracked installment or loan as a goal. One debt at a time. */
export function DebtGoalPrompt() {
  const t = useT().goals.debtPrompt
  const { debts, goals, settings, addGoal } = useFinanceStore(
    useShallow((s) => ({ debts: s.debts, goals: s.goals, settings: s.settings, addGoal: s.addGoal })),
  )
  const [hidden, setHidden] = useState<string[]>(dismissed)
  const tracked = trackedDebtIds(goals)
  const debt = debts.find(
    (d) =>
      d.status !== 'cleared' && !d.isGold && d.debtType !== 'credit_card' && d.direction !== 'they_owe' &&
      d.startingBalance > 0 && !tracked.has(d.id) && !hidden.includes(d.id),
  )
  if (!debt) return null

  const dismiss = () => {
    const next = [...hidden, debt.id]
    setHidden(next)
    try {
      localStorage.setItem(KEY, JSON.stringify(next))
    } catch {
      /* the prompt may return next visit; harmless */
    }
  }
  const track = () => {
    // Re-check at click time: goals may have finished loading since this rendered.
    if (trackedDebtIds(useFinanceStore.getState().goals).has(debt.id)) return dismiss()
    addGoal({
      name: debt.name,
      emoji: '🔓',
      category: 'debt_freedom',
      currency: clampFiatToAllowed(settings, debt.currency === 'XAU' ? settings.baseCurrency : debt.currency),
      targetAmount: debt.startingBalance,
      targetDate: null,
      monthlyContribution: null,
      monthlySpendingLimit: null,
      linkedSavingsAccountIds: [],
      linkedDebtIds: [debt.id],
      priority: goals.reduce((m, g) => Math.max(m, g.priority + 1), 0),
      status: 'active',
      notes: null,
    })
  }

  return (
    <PromptBanner
      icon={<Target />}
      title={t.title(debt.name)}
      description={t.body}
      confirmLabel={t.confirm}
      onConfirm={track}
      dismissLabel={t.dismiss}
      onDismiss={dismiss}
    />
  )
}
