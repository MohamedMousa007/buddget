import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// The sheets mount only when opened; a static render never opens them.
vi.mock('@/components/features/payments/SelectPaymentMethodSheet', () => ({ SelectPaymentMethodSheet: () => null }))
vi.mock('@/components/ui/UnifiedDatePicker', () => ({ UnifiedDatePicker: () => null }))
vi.mock('@/lib/navigation/navigate', () => ({ navigate: vi.fn() }))
vi.mock('@/lib/apiBase', () => ({ apiFetchAuth: vi.fn() }))

import { ProposalCard } from '@/components/features/ai-chat/ProposalCard'
import type { ProposalState, ProposalStatus } from '@/lib/buddgy/client/chatTypes'
import { resetAutoSlots } from '@/lib/buddgy/tools/autoApplyGuard'
import { groupBatches } from '@/lib/buddgy/tools/batch'
import { TOOLS } from '@/lib/buddgy/tools/exec'
import { resetSameTurnMemory } from '@/lib/buddgy/tools/exec/expenses'
import type { PreviewModel, Proposal } from '@/lib/buddgy/tools/proposal'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { PaymentMethod } from '@/lib/store/types'

const ctx = { now: new Date('2026-10-19T12:00:00'), locale: 'en' as const }
const noop = () => {}
const pm = (id: string, name: string, isDefault: boolean, type: PaymentMethod['type'], last4?: string): PaymentMethod =>
  ({ id, name, type, currency: 'EGP', isDefault, ...(last4 ? { last4 } : {}) }) as PaymentMethod

const card = (proposal: Proposal, status: ProposalStatus = 'pending', extra: Partial<ProposalState> = {}) =>
  renderToStaticMarkup(h(ProposalCard, { state: { proposal, status, ...extra }, onApply: noop, onDismiss: noop, onRevise: noop, onUndo: noop, onRemoveRow: noop, onRetry: noop }))

const made = (tool: string, preview: Partial<PreviewModel> & Pick<PreviewModel, 'domain' | 'tone' | 'title'>, risk: Proposal['risk'] = 'approve'): Proposal => ({
  id: `p-${tool}`, tool, args: {}, risk, createdAt: 0, summary: '', preview: { rows: [], ...preview },
})

function propose(tool: string, args: Record<string, unknown>): Proposal {
  const r = TOOLS.get(tool)!.write!.propose(args, ctx)
  if (!r.ok) throw new Error(r.error)
  return r.proposal
}

beforeEach(() => {
  resetAutoSlots()
  resetSameTurnMemory()
  useFinanceStore.setState({
    paymentMethods: [pm('aaaaaaaa-0000-0000-0000-000000000001', 'Cash', true, 'cash'), pm('d4d4d4d4-0000-0000-0000-000000000002', 'CIB Debit', false, 'debit_card', '4417')],
    expenses: [],
    incomeSources: [],
    incomeEvents: [],
    budgetPlans: [],
    activeBudgetPlanId: null,
    exchangeRates: {},
    settings: { ...useFinanceStore.getState().settings, baseCurrency: 'EGP' },
  })
})

describe('the action-card shell, one render per pattern', () => {
  it('record: amount hero, the pay-with strip of mini cards open for a missing method, and the named button', () => {
    const html = card(propose('add_expense', { description: 'Lunch at Zooba', amount: 185 }))
    expect(html).toContain('185.00')
    expect(html).toContain('Lunch at Zooba')
    expect(html).toContain('Needed to add it')
    expect(html).toContain('data-card-face="mini"')
    expect(html).toMatch(/aria-pressed="true"[^>]*aria-label="Cash"/)
    expect(html).toContain('Other payment method, opens the picker')
    expect(html).toContain('guessed')
    expect(html).toContain('>Add expense<')
    expect(html).toContain('>Edit<')
    expect(html).toContain('>Not now<')
  })

  it('batch: a row per expense with a named trash button, the total in the head, and a counting button', () => {
    const rows = [
      propose('add_expense', { description: 'Coffee', amount: 55, category: 'Food', method: 'Cash' }),
      propose('add_expense', { description: 'Uber', amount: 120, category: 'Transport' }),
      propose('add_expense', { description: 'Carrefour', amount: 640, category: 'Groceries', method: 'CIB Debit' }),
    ]
    const html = card(groupBatches(rows, 'en')[0])
    for (const n of ['Coffee', 'Uber', 'Carrefour']) expect(html).toContain(`aria-label="Remove ${n}"`)
    expect(html).toContain('815.00')
    expect(html).toContain('>Add 3 expenses<')
    expect(html).toContain('All of them are added, and undone, together.')
    // Uber had no method: its picker is open in its row.
    expect(html).toContain('Paid with? for Uber')
    expect(html).not.toContain('>Edit<')
  })

  it('batch with every row removed: nothing to add, and the button is off', () => {
    const empty = { ...made('batch', { domain: 'expenses', tone: 'add', title: 'Add expenses', pattern: 'batch', items: [] }) }
    const html = card(empty)
    expect(html).toContain('Nothing left to add.')
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Nothing to add</)
  })

  it('create: the card as the app will draw it, its facts, and a missing field asked as a question', () => {
    const p = propose('add_payment_method', { name: 'QNB', type: 'credit_card', last4: '8820' })
    const html = card(p)
    expect(html).toContain('8820')
    expect(html).toContain('>Add card<')
    const asked = card({ ...p, preview: { ...p.preview, missing: ['last4'] } })
    expect(asked).toContain('One thing I still need')
  })

  it('change: the old value struck through, an arrow, the new value, and the amber effect line', () => {
    const html = card(made('adjust_budget', { domain: 'budget', tone: 'change', title: 'Change your budget', rows: [{ label: 'Groceries', before: '2,800', value: '3,200' }], effect: 'Moves 400 from Dining out' }))
    expect(html).toMatch(/<s[^>]*>2,800<\/s>/)
    expect(html).toContain('3,200')
    expect(html).toContain('Moves 400 from Dining out')
    expect(html).toContain('>Apply change<')
  })

  it('move: both ends with their balance now and after, and the amount in the button', () => {
    const html = card(made('transfer_between_pockets', {
      domain: 'savings', tone: 'change', title: 'Move money', amount: 2000, currency: 'EGP',
      from: { name: 'CIB', now: '24,310.50', after: '22,310.50' }, to: { name: 'NBE Savings', now: '61,000.00', after: '63,000.00' },
    }))
    expect(html).toContain('NBE Savings')
    expect(html).toContain('22,310.50')
    expect(html).toContain('63,000.00')
    expect(html).toMatch(/>Move [^<]*2,000/)
  })

  it('remove: a red head, the item, the consequence, a solid red button and Keep it', () => {
    const html = card(made('cancel_subscription', { domain: 'subscriptions', tone: 'change', title: 'Cancel Shahid VIP', rows: [{ label: 'Price', value: '149.99' }], effect: 'Its reminders stop.' }))
    expect(html).toContain('bg-[var(--color-brand-red-soft)]')
    expect(html).toContain('Its reminders stop.')
    expect(html).toContain('>Yes, cancel it<')
    expect(html).toContain('>Keep it<')
  })

  it('status: the state now and after as badges, and the verb on the button', () => {
    const html = card(made('pause_subscription', { domain: 'subscriptions', tone: 'change', title: 'Pause Gold’s Gym', rows: [{ label: 'Price', value: '1,200' }] }))
    expect(html).toContain('>Active<')
    expect(html).toContain('>Paused<')
    expect(html).toContain('>Pause<')
  })

  it('go: the link chip is the action; there is no separate primary button', () => {
    const html = card(made('open_screen', { domain: 'navigation', tone: 'change', title: 'Open a screen', rows: [{ label: 'Go to', value: 'Savings' }] }))
    expect(html).toContain('Open Savings')
    expect(html).not.toContain('Apply change')
    expect(html).toContain('>Not now<')
  })

  it('a proposal saved before patterns existed still renders its facts', () => {
    const html = card(made('update_goal', { domain: 'goals', tone: 'change', title: 'Change goal', rows: [{ label: 'Target', value: '150,000' }] }))
    expect(html).toContain('Change goal')
    expect(html).toContain('150,000')
  })
})

describe('after states keep their statuses and copy', () => {
  const p = made('add_expense', { domain: 'expenses', tone: 'add', title: 'Coffee · EGP 45' })
  it.each([
    ['applied', 'Done'],
    ['undone', 'Undone'],
    ['dismissed', 'Skipped'],
    ['stale', 'Out of date, ask me again'],
    ['failed', 'Couldn’t apply'],
  ] as const)('%s reads %s', (status, title) => {
    expect(card(p, status)).toContain(title)
  })
  it('Done offers Undo only while it is possible; Couldn’t apply offers Try again', () => {
    expect(card(p, 'applied', { message: 'Coffee · EGP 45', undo: noop })).toContain('Undo')
    expect(card(p, 'applied', { message: 'Coffee · EGP 45' })).not.toContain('Undo')
    expect(card(p, 'failed', { message: 'That payment method no longer exists.' })).toContain('Try again')
    expect(card(p, 'stale')).toContain('Coffee · EGP 45')
  })
})
