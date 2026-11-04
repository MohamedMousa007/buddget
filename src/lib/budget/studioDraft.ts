import type { FlowState } from '@/lib/budget/flow/types'
import type { CreateIntent } from '@/lib/budget/templates'

/** An unfinished Studio run, kept on the device so leaving mid-flow loses nothing. */
export interface StudioDraft {
  /** Shape of `state`; a draft from an older set of questions is dropped, not resumed into the wrong ones. */
  v: 3
  intent: CreateIntent | null
  state: FlowState
  savedAt: number
}

const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

/** The run to continue, or null when there is none, it was for another starting point, or it went stale. */
export function resumeStudioDraft(draft: StudioDraft | null, intent: CreateIntent | null, now: number): FlowState | null {
  if (!draft || draft.v !== 3 || draft.intent !== intent) return null
  return now - draft.savedAt <= MAX_AGE_MS ? draft.state : null
}
