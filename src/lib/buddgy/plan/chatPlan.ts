import { applyScreen, createFlow, flowItems, flowReadiness, nextQuestion, type ScreenAnswer } from '@/lib/budget/flow/flow'
import { knownFromStore } from '@/lib/budget/flow/known'
import type { FlowState } from '@/lib/budget/flow/types'
import { buildFactsFromStore, type FactsSlice } from '@/lib/budget/factsFromStore'
import { isTracked } from '@/lib/accounts/kinds'
import type { PaymentMethod } from '@/lib/store/types'

/** One answered screen: what went into the flow, and the chat bubbles it added, so Back can take both away. */
export interface PlanScreen {
  answers: ScreenAnswer[]
  itemIds: string[]
}

/**
 * The budget builder's questions run inside a Buddgy chat (plan 2.1). Kept on the saved chat, so closing the app mid-way
 * resumes on the same question. The live flow is never stored: it is replayed from `base` and the screens, the same
 * reducer the builder uses, so the two cannot drift.
 */
export interface ChatPlan {
  /** Shape of the flow, as in the builder's draft; an older one is dropped, not resumed into the wrong questions. */
  v: 3
  base: FlowState
  screens: PlanScreen[]
  /** `ready` is set when the person builds before every question is asked; a finished flow is ready by itself. */
  status: 'asking' | 'paused' | 'ready' | 'handed'
  savedAt: number
}

export type PlanPhase = ChatPlan['status']

const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

/** The builder's own starting point: what the app knows, so those questions are not asked. The free-text opener is an AI call, so the chat skips it. */
export function initialFlow(live: FactsSlice & { paymentMethods: PaymentMethod[] }, now = new Date()): FlowState {
  const facts = buildFactsFromStore(live, now)
  return { ...createFlow('mixed', knownFromStore(facts, live.profile.financialProfile, live.paymentMethods.some(isTracked))), opener: 'done' }
}

export const startPlan = (base: FlowState, now: number): ChatPlan => ({ v: 3, base, screens: [], status: 'asking', savedAt: now })

export const planState = (p: ChatPlan): FlowState => p.screens.reduce((s, x) => applyScreen(s, x.answers), p.base)

export function planPhase(p: ChatPlan): PlanPhase {
  if (p.status === 'handed' || p.status === 'ready') return p.status
  return nextQuestion(planState(p)) ? p.status : 'ready'
}

/** "Question N of about M": screens answered plus the screens still waiting (checks that fire late make it "about"). */
export function planProgress(p: ChatPlan): { n: number; of: number; percent: number } {
  const s = planState(p)
  const waiting = new Set(flowItems(s).filter((i) => i.state === 'pending').map((i) => i.node.group ?? i.node.id)).size
  const n = p.screens.length + 1
  return { n, of: Math.max(n, p.screens.length + waiting), percent: flowReadiness(s).percent }
}

/** Enough is known to build before the last question, as the builder's "build now" offers. */
export const canBuildEarly = (p: ChatPlan): boolean => p.screens.length > 0 && flowReadiness(planState(p)).enough && nextQuestion(planState(p)) !== undefined

export const answerScreen = (p: ChatPlan, answers: ScreenAnswer[], itemIds: string[], now: number): ChatPlan => ({
  ...p, screens: [...p.screens, { answers, itemIds }], status: 'asking', savedAt: now,
})

/** Takes back the last screen. Returns the plan and the chat bubbles to remove. */
export function backScreen(p: ChatPlan, now: number): { plan: ChatPlan; drop: string[] } {
  const last = p.screens.at(-1)
  if (!last || p.status === 'handed') return { plan: p, drop: [] }
  return { plan: { ...p, screens: p.screens.slice(0, -1), status: 'asking', savedAt: now }, drop: last.itemIds }
}

export const setPhase = (p: ChatPlan, status: 'asking' | 'paused' | 'ready' | 'handed', now: number): ChatPlan => ({ ...p, status, savedAt: now })

/** While a question waits, the composer answers it: nothing typed goes to the model, so the questions cost nothing. */
export const routesToPlan = (p: ChatPlan | null): p is ChatPlan => p !== null && planPhase(p) === 'asking'

/** A plan read back from the phone, or null when it is from another question set or went stale. */
export function resumePlan(p: ChatPlan | null | undefined, now: number): ChatPlan | null {
  if (!p || p.v !== 3) return null
  return now - p.savedAt <= MAX_AGE_MS ? p : null
}

/** What the builder opens on: the collected answers, with the opener already behind it. */
export const handoverState = (p: ChatPlan): FlowState => ({ ...planState(p), opener: 'done' })
