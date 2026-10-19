import type { ProposeResult } from '@/lib/buddgy/tools/proposal'

/** A validated plan, or the failure to hand back to the model. Check `plan.error` first. */
export type Plan<T> = { error: ProposeResult } | (T & { error?: undefined })

export const reason = (r: ProposeResult): string => (r.ok ? 'This is no longer valid.' : r.error)

/** Marks a successful plan so `plan.error` narrows cleanly. */
export const done = <T extends object>(v: T): T & { error?: undefined } => v
