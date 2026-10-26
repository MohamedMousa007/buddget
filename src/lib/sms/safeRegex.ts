/**
 * ReDoS guard for regexes that run on every user's SMS (learned templates, admin edits).
 *
 * V8 backtracks, so a quantified group that itself holds an unbounded quantifier — `(a+)+`, `(\d*)*`,
 * `(?:x+y?)*` — can take exponential time on a near-miss and stall the event loop for every request.
 */

export const MAX_REGEX_PATTERN_CHARS = 1000

/** Longest SMS body a template regex is run against; real bank SMS are far shorter. */
export const MAX_TEMPLATE_INPUT_CHARS = 2000

/** Escapes and character classes carry quantifier characters that are not quantifiers. */
function stripLiterals(pattern: string): string {
  return pattern.replace(/\\./g, 'x').replace(/\[(?:\\.|[^\]\\])*\]/g, 'x')
}

/** The quantifier text starting at `i` is unbounded: `+`, `*` or `{n,}` / `{n,m}`. */
function unboundedQuantifierAt(s: string, i: number): boolean {
  if (s[i] === '+' || s[i] === '*') return true
  const m = /^\{\d+,\d*\}/.exec(s.slice(i, i + 12))
  return m !== null && !/^\{\d+,\d+\}$/.test(m[0])
}

export function isSafeRegexPattern(pattern: string): boolean {
  if (pattern.length > MAX_REGEX_PATTERN_CHARS) return false
  const s = stripLiterals(pattern)
  const groupHasUnbounded: boolean[] = [false]
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === '(') groupHasUnbounded.push(false)
    else if (c === ')' && groupHasUnbounded.length > 1) {
      const inner = groupHasUnbounded.pop()!
      const quantified = unboundedQuantifierAt(s, i + 1)
      if (inner && quantified) return false
      groupHasUnbounded[groupHasUnbounded.length - 1] ||= inner || quantified
    } else if (unboundedQuantifierAt(s, i)) {
      groupHasUnbounded[groupHasUnbounded.length - 1] = true
    }
  }
  return true
}
