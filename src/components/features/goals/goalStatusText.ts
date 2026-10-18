import type { Dictionary } from '@/lib/i18n/types'
import type { Goal } from '@/lib/store/types'
import type { GoalStatusView } from '@/lib/goals/goalStatus'
import { formatCurrency } from '@/lib/utils/formatters'

type Home = Dictionary['goals']['home']

export function goalStatusText(v: GoalStatusView, goal: Goal, t: Home): string {
  const q = goal.frequency === 'quarterly'
  const money = (n: number) => formatCurrency(n, goal.currency, false)
  switch (v.kind) {
    case 'over': return t.statusOver(money(v.params.amount ?? 0))
    case 'underLimit': return t.statusLeft(money(v.params.amount ?? 0))
    case 'due': return t.statusDue(v.params.count ?? 0)
    case 'behind': return t.statusBehind(v.params.count ?? 1, q)
    case 'oneDeposit': return t.statusOneDeposit
    case 'streak': return t.statusStreak(v.params.count ?? 3, q)
    case 'paused': return t.statusPaused
    case 'next': return t.statusNext(v.params.pct ?? 25, money(v.params.toGo ?? 0))
  }
}

export const ACTION_LABEL = {
  adjust: 'actionAdjust',
  review: 'actionReview',
  replan: 'actionReplan',
  addMoney: 'actionAddMoney',
  resume: 'actionResume',
} as const satisfies Record<GoalStatusView['button']['action'], keyof Home>
