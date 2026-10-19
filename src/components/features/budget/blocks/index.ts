import type { BudgetBlock } from '@/lib/store/types'
import type { BlockBodyProps } from '@/components/features/budget/types'
import { BillsBlockBody } from './BillsBlockBody'
import { DebtsBlockBody } from './DebtsBlockBody'
import { EverydayBlockBody } from './EverydayBlockBody'
import { GoalsBlockBody } from './GoalsBlockBody'
import { GrowBlockBody } from './GrowBlockBody'
import { SafetyBlockBody } from './SafetyBlockBody'
import { SubscriptionsBlockBody } from './SubscriptionsBlockBody'

export const BLOCK_BODIES: Record<BudgetBlock, (p: BlockBodyProps) => React.JSX.Element> = {
  bills: BillsBlockBody,
  subscriptions: SubscriptionsBlockBody,
  debts: DebtsBlockBody,
  everyday: EverydayBlockBody,
  safety: SafetyBlockBody,
  goals: GoalsBlockBody,
  grow: GrowBlockBody,
}

export {
  BillsBlockBody, DebtsBlockBody, EverydayBlockBody, GoalsBlockBody, GrowBlockBody, SafetyBlockBody, SubscriptionsBlockBody,
}
