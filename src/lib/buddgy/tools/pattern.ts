import type { PreviewEntity, Proposal, ProposalPattern } from '@/lib/buddgy/tools/proposal'

/**
 * Which card body a tool gets. Named tools first, because the name prefix and the risk both mislead:
 * `activate_budget_plan` is `strong` but is a status flip, `cancel_subscription` is `approve` but removes.
 */
const BY_NAME: Record<string, ProposalPattern> = {
  add_expense: 'record',
  add_income: 'record',
  mark_payday_received: 'record',
  add_to_goal: 'record',
  record_debt_payment: 'record',
  deposit_to_savings: 'record',
  mark_subscription_paid: 'record',
  transfer_between_pockets: 'move',
  withdraw_from_savings: 'move',
  resume_subscription: 'status',
  achieve_goal: 'status',
  activate_budget_plan: 'status',
  cancel_subscription: 'remove',
  clear_debt: 'remove',
  forget_memory: 'remove',
  remember: 'create',
  open_screen: 'go',
  open_setting: 'go',
  open_sheet: 'go',
  start_budget_setup: 'plan',
}

const ENTITY: Record<string, PreviewEntity> = {
  add_payment_method: 'card',
  add_credit_card: 'card',
  add_savings_account: 'account',
  add_debt: 'debt',
  add_installment_plan: 'plan',
  add_subscription: 'subscription',
  add_goal: 'goal',
  add_income: 'income',
  add_investment_holding: 'holding',
  remember: 'memory',
}

export function derivePattern(tool: string, tone?: 'add' | 'change' | 'danger'): ProposalPattern {
  const named = BY_NAME[tool]
  if (named) return named
  if (/^(delete|forget|cancel|clear)_/.test(tool) || tone === 'danger') return 'remove'
  if (/^add_/.test(tool)) return 'create'
  return 'change'
}

export const entityOf = (tool: string): PreviewEntity | undefined => ENTITY[tool]

/** The body for a proposal: what the tool said, else the name rule. Saved chats from before the field still render. */
export const patternOf = (p: Proposal): ProposalPattern => p.preview.pattern ?? derivePattern(p.tool, p.preview.tone)
