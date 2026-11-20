import { beforeEach, describe, expect, it, vi } from 'vitest'

// The questions must never reach the model or the network (plan 2.1): both are spies that must stay untouched.
vi.mock('@/lib/apiBase', () => ({ apiFetchAuth: vi.fn() }))
vi.mock('@/lib/buddgy/client/runTurn', () => ({ runTurn: vi.fn(), TurnFailure: class extends Error {} }))
vi.mock('@/lib/budget/budgetAiClient', () => ({ refineDraft: vi.fn(), readSituation: vi.fn() }))

import { apiFetchAuth } from '@/lib/apiBase'
import { runTurn } from '@/lib/buddgy/client/runTurn'
import { refineDraft } from '@/lib/budget/budgetAiClient'
import type { ChatItem } from '@/lib/buddgy/client/chatTypes'
import { forSaving, restoreItems, type SavedChat } from '@/lib/buddgy/client/savedChats'
import { applyScreen, createFlow, defaultFor, nextQuestion, screenNodes, type ScreenAnswer } from '@/lib/budget/flow/flow'
import { knownFromStore } from '@/lib/budget/flow/known'
import type { FlowNode, FlowState, FlowValue } from '@/lib/budget/flow/types'
import { buildFactsFromStore, type FactsSlice } from '@/lib/budget/factsFromStore'
import { engineDraft, studioFacts } from '@/lib/budget/studioPreview'
import { budgetStudioCopyEn } from '@/lib/i18n/budgetPage/studioCopy'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { canBuildEarly, handoverState, initialFlow, planPhase, planProgress, planState, resumePlan, routesToPlan, setPhase, startPlan, type ChatPlan } from '../chatPlan'
import { chatPreview, summarize } from '../planSummary'
import { submitScreen, takeBack, typedAnswer, type PlanCtx } from '../planTurns'

const NOW = new Date(2026, 10, 20)

const slice = (o: Record<string, unknown> = {}) =>
  ({
    profile: { id: 'u', name: 'U', createdAt: '' },
    settings: { baseCurrency: 'EGP', monthStartDay: 1, noIncomeDeclared: false },
    incomeSources: [], incomeEvents: [], expenses: [], recurringExpenses: [], subscriptions: [],
    debts: [], debtPayments: [], goals: [], savingsAccounts: [], exchangeRates: {},
    budgetCategories: [], budgetPlans: [], activeBudgetPlanId: null, goldPricePerGram: 0, goldPriceAvailable: false,
    paymentMethods: [],
    ...o,
  }) as unknown as FactsSlice & { paymentMethods: [] }

/** One person's answers; anything not listed takes the builder's own starting value, or the first option. */
const SCRIPT: Record<string, FlowValue> = {
  income: 20000, incomeType: 'salary', incomeStability: 'fixed', housing: 'rent', rent: 6000, household: 'solo',
  hasDebts: false, hasGoal: true, goalKind: 'car', goalTarget: 120000, goalSaved: 10000, savingsOnHand: 15000,
}
function valueFor(x: FlowNode, s: FlowState): FlowValue {
  if (SCRIPT[x.id] !== undefined) return SCRIPT[x.id]
  const d = defaultFor(x, s)
  if (d !== undefined) return d
  if (x.control === 'amount') return 1000
  if (x.control === 'toggle') return false
  return x.opts?.[0] ?? 0
}
/** The screen the builder would show now, answered the way the person answers it. */
function screenAnswers(s: FlowState): ScreenAnswer[] {
  const head = nextQuestion(s)!
  const values: Record<string, FlowValue> = {}
  let nodes = screenNodes(s, head, values, [])
  // Fill fields one by one, as the person does: each answer can reveal the next field on the screen.
  for (let i = 0; i < 8; i++) {
    for (const x of nodes) values[x.id] ??= valueFor(x, s)
    const more = screenNodes(s, head, values, [])
    if (more.length === nodes.length) break
    nodes = more
  }
  return nodes.map((x) => ({ id: x.id, value: values[x.id] }))
}

const ctx = (): PlanCtx => {
  let n = 0
  return { ui: budgetStudioCopyEn, money: (v) => `EGP ${v}`, now: NOW.getTime(), newId: () => `id-${++n}` }
}

const live = slice({ settings: { baseCurrency: 'EGP', monthStartDay: 1, noIncomeDeclared: false } })

function runBoth() {
  // The builder: createFlow from what the app knows, then each screen through its submit reducer.
  let builder = createFlow('mixed', knownFromStore(buildFactsFromStore(live, NOW), live.profile.financialProfile, false))
  // The chat: the same start, the same screens, through the chat's own steps.
  let plan = startPlan(initialFlow(live, NOW), NOW.getTime())
  let items: ChatItem[] = []
  const c = ctx()
  for (let i = 0; i < 60 && nextQuestion(builder); i++) {
    const answers = screenAnswers(builder)
    builder = applyScreen(builder, answers)
    const step = submitScreen(plan, items, answers, c)
    plan = step.plan
    items = step.items
  }
  return { builder, plan, items }
}

beforeEach(() => vi.clearAllMocks())

describe('the chat runs the builder flow', () => {
  it('gives the same answers, skips and facts as the builder for the same inputs', () => {
    const { builder, plan } = runBoth()
    const chat = planState(plan)
    expect(nextQuestion(builder)).toBeUndefined()
    expect(chat.a).toEqual(builder.a)
    expect(chat.skipped).toEqual(builder.skipped)
    expect(chat.cursor).toBe(builder.cursor)
    expect(studioFacts(live, chat.a, chat.intent, new Set(), NOW)).toEqual(studioFacts(live, builder.a, builder.intent, new Set(), NOW))
    expect(chatPreview(live, plan, NOW)).toEqual(engineDraft(studioFacts(live, builder.a, builder.intent, new Set(), NOW)))
  })

  it('shows each question as Buddgy and each answer as the person, two bubbles per screen', () => {
    const { plan, items } = runBoth()
    expect(items).toHaveLength(plan.screens.length * 2)
    expect(items[0]).toMatchObject({ role: 'buddgy', text: budgetStudioCopyEn.q.income.label, status: 'done' })
    expect(items[1]).toMatchObject({ role: 'user' })
    expect(items[1].text).toContain('EGP 20000')
  })

  it('is ready when the last question is answered, and the summary adds up to the lines', () => {
    const { plan } = runBoth()
    expect(planPhase(plan)).toBe('ready')
    const sum = summarize(chatPreview(live, plan, NOW))
    expect(sum.income).toBeGreaterThan(0)
    expect(sum.top.length).toBeGreaterThan(0)
    expect(sum.chapters.reduce((t, c) => t + c.amount, 0)).toBeCloseTo(sum.top.reduce((t, l) => t + l.amount, 0) + sum.rest.amount, 2)
  })

  it('Back takes the last screen and its two bubbles away', () => {
    const { plan, items } = runBoth()
    const back = takeBack(plan, items, NOW.getTime())
    expect(back.plan.screens).toHaveLength(plan.screens.length - 1)
    expect(back.items).toHaveLength(items.length - 2)
    expect(planPhase(back.plan)).toBe('asking')
  })

  it('offers "build now" only once enough is known and a question is still waiting', () => {
    const start = startPlan(initialFlow(live, NOW), NOW.getTime())
    expect(canBuildEarly(start)).toBe(false)
    expect(planProgress(start)).toMatchObject({ n: 1 })
    expect(planProgress(start).of).toBeGreaterThanOrEqual(1)
  })
})

describe('typed answers', () => {
  it('a readable reply answers the question asked now and shows as typed', () => {
    const p = startPlan(initialFlow(live, NOW), NOW.getTime())
    expect(nextQuestion(planState(p))?.id).toBe('income')
    const step = typedAnswer(p, [], '18,500', ctx())!
    expect(planState(step.plan).a.income).toBe(18500)
    expect(step.items[1]).toMatchObject({ role: 'user', text: '18,500' })
  })

  it('an unreadable reply changes nothing, so the question is asked again', () => {
    const p = startPlan(initialFlow(live, NOW), NOW.getTime())
    expect(typedAnswer(p, [], 'no idea', ctx())).toBeNull()
  })
})

describe('no model call during the questions', () => {
  it('runs a whole plan, typed and tapped, with no turn, no network and no AI build', () => {
    let p = startPlan(initialFlow(live, NOW), NOW.getTime())
    let items: ChatItem[] = []
    expect(routesToPlan(p)).toBe(true)
    const typed = typedAnswer(p, items, '20000', ctx())!
    p = typed.plan
    items = typed.items
    for (let i = 0; i < 60 && planPhase(p) === 'asking'; i++) {
      const step = submitScreen(p, items, screenAnswers(planState(p)), ctx())
      p = step.plan
      items = step.items
    }
    summarize(chatPreview(live, p, NOW))
    expect(runTurn).not.toHaveBeenCalled()
    expect(apiFetchAuth).not.toHaveBeenCalled()
    expect(refineDraft).not.toHaveBeenCalled()
  })

  it('the composer answers the plan only while a question waits', () => {
    const p = startPlan(initialFlow(live, NOW), NOW.getTime())
    expect(routesToPlan(null)).toBe(false)
    expect(routesToPlan(p)).toBe(true)
    expect(routesToPlan(setPhase(p, 'paused', 0))).toBe(false)
    expect(routesToPlan(setPhase(p, 'ready', 0))).toBe(false)
    expect(routesToPlan(setPhase(p, 'handed', 0))).toBe(false)
  })
})

describe('resume from a saved chat', () => {
  it('a plan closed mid-way comes back on the same question with the same answers', () => {
    let p = startPlan(initialFlow(live, NOW), NOW.getTime())
    let items: ChatItem[] = [{ id: 'u0', role: 'user', text: 'Make me a budget' }]
    for (let i = 0; i < 3; i++) {
      const step = submitScreen(p, items, screenAnswers(planState(p)), ctx())
      p = step.plan
      items = step.items
    }
    const saved: SavedChat = { id: 'c', serverChatId: null, title: 't', createdAt: 0, updatedAt: 0, items: forSaving(items), tainted: false, plan: p }
    const read = JSON.parse(JSON.stringify(saved)) as SavedChat
    const back = resumePlan(read.plan, NOW.getTime() + 60_000)!
    expect(back).not.toBeNull()
    expect(planState(back)).toEqual(planState(p))
    expect(nextQuestion(planState(back))?.id).toBe(nextQuestion(planState(p))?.id)
    expect(routesToPlan(back)).toBe(true)
    expect(restoreItems(read.items)).toHaveLength(items.length)
  })

  it('drops a plan from another question set or one left for over a week', () => {
    const p = startPlan(initialFlow(live, NOW), NOW.getTime())
    expect(resumePlan({ ...p, v: 2 } as unknown as ChatPlan, NOW.getTime())).toBeNull()
    expect(resumePlan(p, NOW.getTime() + 8 * 86_400_000)).toBeNull()
    expect(resumePlan(undefined, NOW.getTime())).toBeNull()
  })
})

describe('hand-over to the builder', () => {
  it('opens the builder on the collected answers, past its AI opener', () => {
    const { plan } = runBoth()
    const state = handoverState(plan)
    expect(state.opener).toBe('done')
    expect(state.a).toEqual(planState(plan).a)
    useSettingsStore.getState().requestBudgetStudio(state)
    expect(useSettingsStore.getState()).toMatchObject({ budgetStudioRequested: true, budgetStudioHandover: state })
    useSettingsStore.getState().clearBudgetStudioRequest()
    expect(useSettingsStore.getState()).toMatchObject({ budgetStudioRequested: false, budgetStudioHandover: null })
  })

  it('a plain builder request carries no answers, and the hand-over is never written to the phone', () => {
    useSettingsStore.getState().requestBudgetStudio()
    expect(useSettingsStore.getState().budgetStudioHandover).toBeNull()
    useSettingsStore.getState().clearBudgetStudioRequest()
    const { plan } = runBoth()
    useSettingsStore.getState().requestBudgetStudio(handoverState(plan))
    const persisted = useSettingsStore.persist.getOptions().partialize?.(useSettingsStore.getState()) as Record<string, unknown>
    expect(persisted).not.toHaveProperty('budgetStudioHandover')
    useSettingsStore.getState().clearBudgetStudioRequest()
  })

  it('handed over is final: the plan no longer takes answers', () => {
    const { plan } = runBoth()
    const handed = setPhase(plan, 'handed', 0)
    expect(planPhase(handed)).toBe('handed')
    expect(submitScreen(handed, [], [{ id: 'income', value: 1 }], ctx()).plan).toBe(handed)
    expect(takeBack(handed, [], 0).plan).toBe(handed)
  })
})
