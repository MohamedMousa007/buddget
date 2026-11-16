import type { BuddgyIntent, WireMessage } from '@/lib/buddgy/protocol'

/** Screen context sent with a turn: short for a quick answer, longer for the Advisor. */
export const CONTEXT_CHARS = { quick: 1500, advisor: 3000 } as const
/** Tool hops inside one user turn: the cap the plan allows. */
export const MAX_HOPS = { free: 2, pro: 3 } as const
/** Reasoning budget of the one free Advisor answer a month (Pro uses the full budget). */
export const FREE_ADVISOR_THINKING_BUDGET = 512

export interface AdvisorGate {
  entitled: boolean
  /** Free answers left this month, or one still open for the turn that used it. */
  freeOpen: boolean
}

export type AdvisorMode = 'none' | 'pro' | 'free' | 'locked'

/**
 * Which Advisor path a turn takes. Only an `advice` turn is an Advisor turn; a plan without the Advisor gets its one free answer,
 * and after that the fast tier answers with a one-line note that the Advisor is in Pro.
 */
export function resolveAdvisor(intent: BuddgyIntent, gate: AdvisorGate | null): { mode: AdvisorMode; intent: BuddgyIntent } {
  if (intent !== 'advice') return { mode: 'none', intent }
  if (gate?.entitled) return { mode: 'pro', intent }
  if (gate?.freeOpen) return { mode: 'free', intent }
  return { mode: 'locked', intent: 'answer' }
}

export function trimContext(context: string, intent: BuddgyIntent): string {
  const max = intent === 'advice' ? CONTEXT_CHARS.advisor : CONTEXT_CHARS.quick
  return context.length > max ? context.slice(0, max) : context
}

/** Tool hops already taken in the turn: tool-result messages after the last user message. */
export function hopsDone(messages: readonly WireMessage[]): number {
  let n = 0
  for (let i = messages.length - 1; i >= 0 && messages[i]!.role !== 'user'; i--) if (messages[i]!.role === 'tool') n++
  return n
}
