import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('@/lib/navigation/navigate', () => ({ navigate: vi.fn() }))
vi.mock('@/lib/apiBase', () => ({ apiFetchAuth: vi.fn() }))

import { ProposalCard } from '@/components/features/ai-chat/ProposalCard'
import { PlanBlock } from '@/components/features/ai-chat/plan/PlanBlock'
import { PlanProgress } from '@/components/features/ai-chat/plan/PlanProgress'
import { TOOLS } from '@/lib/buddgy/tools/exec'
import { initialFlow, setPhase, startPlan, type ChatPlan } from '@/lib/buddgy/plan/chatPlan'
import { applyScreen } from '@/lib/budget/flow/flow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'

const noop = () => {}
const ctx = { now: new Date('2026-11-20T12:00:00'), locale: 'en' as const }

beforeEach(() => {
  vi.spyOn(useFinanceStore, 'getInitialState').mockImplementation(() => useFinanceStore.getState())
  useFinanceStore.setState({ paymentMethods: [], expenses: [], incomeSources: [], incomeEvents: [], budgetPlans: [], activeBudgetPlanId: null, exchangeRates: {}, settings: { ...useFinanceStore.getState().settings, baseCurrency: 'EGP' } })
})

const block = (plan: ChatPlan, missed = false) =>
  renderToStaticMarkup(h(PlanBlock, { plan, missed, onAnswer: noop, onBack: noop, onResume: noop, onBuildEarly: noop, onHandOver: noop }))

describe('budget in the chat, rendered', () => {
  it('the budget request card offers both paths and says what it costs', () => {
    const r = TOOLS.get('start_budget_setup')!.write!.propose({}, ctx)
    if (!r.ok) throw new Error(r.error)
    const html = renderToStaticMarkup(h(ProposalCard, { state: { proposal: r.proposal, status: 'pending' }, onApply: noop, onDismiss: noop, onRevise: noop, onUndo: noop, onBuildHere: noop }))
    expect(html).toContain('Build it here with me')
    expect(html).toContain('Open the budget builder')
    expect(html).toContain('1 AI budget build, not your chat usage')
  })

  it('the progress strip names the question and has Pause', () => {
    const html = renderToStaticMarkup(h(PlanProgress, { n: 3, of: 8, onPause: noop }))
    expect(html).toContain('question 3 of about 8')
    expect(html).toContain('>Pause<')
  })

  it('the question card is the builder screen, with its control and Continue', () => {
    const html = block(startPlan(initialFlow(useFinanceStore.getState()), Date.now()))
    expect(html).toContain('What do you take home in a normal month?')
    expect(html).toContain('Continue')
    expect(html).not.toContain('>Back<')
  })

  it('a reply it could not read says so under the card', () => {
    expect(block(startPlan(initialFlow(useFinanceStore.getState()), Date.now()), true)).toContain('I didn’t catch that')
  })

  it('a paused plan offers to continue', () => {
    expect(block(setPhase(startPlan(initialFlow(useFinanceStore.getState()), Date.now()), 'paused', 0))).toContain('Continue the plan')
  })

  it('the ready card shows the engine plan and hands over to the builder; nothing is saved here', () => {
    const base = initialFlow(useFinanceStore.getState())
    const plan = setPhase({ ...startPlan(base, Date.now()), screens: [{ answers: [{ id: 'income', value: 20000 }, { id: 'incomeType', value: 'salary' }, { id: 'incomeStability', value: 'fixed' }], itemIds: [] }, { answers: [{ id: 'housing', value: 'rent' }, { id: 'rent', value: 6000 }], itemIds: [] }] }, 'ready', 0)
    expect(applyScreen(base, plan.screens[0].answers).a.income).toBe(20000)
    const html = block(plan)
    expect(html).toContain('Review and save in the builder')
    expect(html).toContain('Change an answer')
    expect(html).toContain('Nothing is saved until you review it in the builder.')
    expect(html).toContain('20,000')
    const handed = block(setPhase(plan, 'handed', 0))
    expect(handed).not.toContain('Review and save in the builder')
    expect(handed).toContain('Opened in the builder')
  })
})
