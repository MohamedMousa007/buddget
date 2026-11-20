import type { Proposal } from '@/lib/buddgy/tools/proposal'
import type { BuddgyIntent } from '@/lib/buddgy/protocol'
import type { BuddgyMood } from '@/components/ai/BuddgyIcon'

/** A moment Buddgy's face should react to: a reply landed, a change was saved. */
export interface BuddgyBeat {
  mood: BuddgyMood
  at: number
}

export type ProposalStatus = 'pending' | 'applied' | 'dismissed' | 'failed' | 'stale' | 'undone'

export interface ProposalState {
  proposal: Proposal
  status: ProposalStatus
  /** What happened, once decided: the success line or the failure reason. */
  message?: string
  /** Present while an Undo is still possible. */
  undo?: () => void
}

/** What a read tool looked at, so the answer can show where its numbers came from. */
export interface ReadNote {
  tool: string
  label: string
}

export type ChatError =
  | { kind: 'offline' }
  | { kind: 'quota'; layer: string; resetAt: string | null }
  | { kind: 'unauthorized' }
  | { kind: 'blocked' }
  | { kind: 'failed' }

export interface UserItem {
  id: string
  role: 'user'
  text: string
  /** Sent as a voice message: the words are the transcript. */
  voice?: boolean
}

export interface BuddgyItem {
  id: string
  role: 'buddgy'
  text: string
  proposals: ProposalState[]
  reads: ReadNote[]
  status: 'streaming' | 'done' | 'error'
  error?: ChatError
  truncated?: boolean
  /** Set when this reply answered without the model (local fast path). */
  local?: boolean
  /** `free`: it used the plan's free monthly Advisor answer. `locked`: the Advisor is in Pro, so the fast model answered. */
  advisor?: 'free' | 'locked'
  /** How the server made this reply (BDG-010): `thinking` only when it really ran above the minimal thinking level. */
  mode?: 'quick' | 'thinking'
  /** The chat passed its soft budget: suggest a fresh one. */
  longChat?: boolean
}

export type ChatItem = UserItem | BuddgyItem

export interface TurnOutcome {
  text: string
  proposals: Proposal[]
  reads: ReadNote[]
  chatId: string | null
  rolled: boolean
  soft: boolean
  truncated: boolean
  intent: BuddgyIntent
  advisor?: 'free' | 'locked'
  mode?: 'quick' | 'thinking'
}
