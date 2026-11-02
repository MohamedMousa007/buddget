import { createContext, runInContext } from 'node:vm'

/**
 * Runs a template regex with a hard time limit. A static pattern check cannot rule out every catastrophic-backtracking
 * shape (adjacent overlapping quantifiers such as `\d+\d+\d+x` slip through), and a regex on the request thread cannot
 * be interrupted, so the match runs inside a vm context whose `timeout` stops it. Throws when the limit is hit.
 */
const box = { p: '', f: '', s: '' }
const context = createContext(box)

export const REGEX_TIME_LIMIT_MS = 50

export function execBounded(pattern: string, flags: string, input: string): RegExpExecArray | null {
  box.p = pattern
  box.f = flags
  box.s = input
  return runInContext('new RegExp(p, f).exec(s)', context, { timeout: REGEX_TIME_LIMIT_MS }) as RegExpExecArray | null
}
