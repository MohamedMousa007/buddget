import { describe, expect, it, vi } from 'vitest'
vi.mock('@/lib/navigation/navigate', () => ({ navigate: vi.fn() }))
vi.mock('@/lib/apiBase', () => ({ apiFetchAuth: vi.fn() }))
import { TOOLS } from '@/lib/buddgy/tools/exec'
import { derivePattern, entityOf, patternOf } from '@/lib/buddgy/tools/pattern'
import type { Proposal, ProposalPattern } from '@/lib/buddgy/tools/proposal'

// docs/quality/buddget-remediation/buddgy-action-cards.md: one shell, eight bodies.
const EXPECTED: Record<string, ProposalPattern> = {
  add_expense: 'record', add_income: 'record', mark_payday_received: 'record', add_to_goal: 'record',
  record_debt_payment: 'record', deposit_to_savings: 'record', mark_subscription_paid: 'record',
  add_payment_method: 'create', add_credit_card: 'create', add_savings_account: 'create', add_debt: 'create',
  add_installment_plan: 'create', add_subscription: 'create', add_goal: 'create', add_investment_holding: 'create', remember: 'create',
  update_expense: 'change', update_income: 'change', update_debt: 'change', update_goal: 'change', update_subscription: 'change',
  update_payment_method: 'change', update_profile: 'change', update_investment_holding: 'change', adjust_budget: 'change',
  adopt_subscription_price: 'change', change_setting: 'change', correct_savings_balance: 'change',
  transfer_between_pockets: 'move', withdraw_from_savings: 'move',
  delete_expense: 'remove', delete_income: 'remove', delete_debt: 'remove', delete_debt_payment: 'remove', delete_goal: 'remove',
  delete_subscription: 'remove', delete_payment_method: 'remove', delete_savings_account: 'remove', delete_investment_holding: 'remove',
  delete_budget_plan: 'remove', cancel_subscription: 'remove', clear_debt: 'remove', forget_memory: 'remove',
  resume_subscription: 'status', achieve_goal: 'status', activate_budget_plan: 'status',
  open_screen: 'go', open_setting: 'go', open_sheet: 'go', start_budget_setup: 'plan',
}

const writeTools = [...TOOLS.values()].filter((t) => t.write).map((t) => t.spec)

describe('every write tool gets a card pattern', () => {
  it('the table names every write tool (a new tool must pick its body)', () => {
    expect(writeTools.map((s) => s.name).filter((n) => !(n in EXPECTED))).toEqual([])
  })

  it.each(writeTools.map((s) => [s.name, s.risk] as const))('%s', (name) => {
    expect(derivePattern(name)).toBe(EXPECTED[name])
  })

  it('the risk does not decide it: a strong plan switch is a status, an approve cancel is a removal', () => {
    expect(TOOLS.get('activate_budget_plan')?.spec.risk).toBe('strong')
    expect(derivePattern('activate_budget_plan', 'danger')).toBe('status')
    expect(TOOLS.get('cancel_subscription')?.spec.risk).toBe('approve')
    expect(derivePattern('cancel_subscription', 'change')).toBe('remove')
  })

  it('an unknown tool still renders: by prefix, then by tone, else a change', () => {
    expect(derivePattern('delete_thing')).toBe('remove')
    expect(derivePattern('add_thing')).toBe('create')
    expect(derivePattern('do_thing', 'danger')).toBe('remove')
    expect(derivePattern('do_thing')).toBe('change')
  })

  it('create tools name what they add', () => {
    expect(entityOf('add_credit_card')).toBe('card')
    expect(entityOf('add_savings_account')).toBe('account')
    expect(entityOf('add_goal')).toBe('goal')
    expect(entityOf('update_goal')).toBeUndefined()
  })
})

describe('patternOf', () => {
  const base: Omit<Proposal, 'tool'> = { id: 'p', args: {}, risk: 'approve', createdAt: 0, summary: '', preview: { domain: 'income', tone: 'add', title: 'Add', rows: [] } }
  it('a pattern the tool set wins over the name rule', () => {
    expect(patternOf({ ...base, tool: 'add_income', preview: { ...base.preview, pattern: 'create' } })).toBe('create')
  })
  it('a proposal saved before the field existed still gets a body', () => {
    expect(patternOf({ ...base, tool: 'add_income' })).toBe('record')
    expect(patternOf({ ...base, tool: 'delete_goal' })).toBe('remove')
  })
})
