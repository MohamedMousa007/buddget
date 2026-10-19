import type { StudioState } from '@/lib/budget/infoGaps'
import type { CreateIntent } from '@/lib/budget/templates'

/** An unfinished Studio run, kept on the device so leaving mid-flow loses nothing. */
export interface StudioDraft {
  intent: CreateIntent | null
  state: StudioState
  savedAt: number
}

const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

/** The run to continue, or null when there is none, it was for another starting point, or it went stale. */
export function resumeStudioDraft(draft: StudioDraft | null, intent: CreateIntent | null, now: number): StudioState | null {
  if (!draft || draft.intent !== intent || draft.state.v !== 2) return null
  return now - draft.savedAt <= MAX_AGE_MS ? draft.state : null
}
