/**
 * ReDoS guard for regexes that run on every user's SMS (learned templates, admin edits).
 *
 * V8 backtracks, so two shapes can stall the event loop for every request on a near-miss:
 *  - a quantified group that itself holds an unbounded quantifier: `(a+)+`, `(\d*)*`, `(?:x+y?)*` (exponential);
 *  - three or more unbounded atoms in a row that can match the same characters: `\d+\d+\d+x` (polynomial, 99 s at 1,000 characters).
 * Two overlapping atoms in a row are the everyday `[\d,]+\.?\d*` and stay allowed.
 */

export const MAX_REGEX_PATTERN_CHARS = 1000

/** Longest SMS body a template regex is run against; real bank SMS are a few hundred characters. */
export const MAX_TEMPLATE_INPUT_CHARS = 1000

/** Unbounded atoms in a row (optional atoms between them do not break the row) that may match the same characters. */
const MAX_AMBIGUOUS_RUN = 3

/** Unbounded `.` wildcards each multiply the work on a near-miss; real templates use one. */
const MAX_WILDCARDS = 2

/** Real SMS never hold eight spaces in a row; a run that long only exists to make `\s+` backtrack. A run with a line break stays one. */
export function squeezeWhitespace(text: string): string {
  return text.replace(/\s{8,}/g, (run) => (run.includes('\n') ? '\n' : ' '))
}

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

function hasNestedQuantifier(pattern: string): boolean {
  const s = stripLiterals(pattern)
  const groupHasUnbounded: boolean[] = [false]
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === '(') groupHasUnbounded.push(false)
    else if (c === ')' && groupHasUnbounded.length > 1) {
      const inner = groupHasUnbounded.pop()!
      const quantified = unboundedQuantifierAt(s, i + 1)
      if (inner && quantified) return true
      groupHasUnbounded[groupHasUnbounded.length - 1] ||= inner || quantified
    } else if (unboundedQuantifierAt(s, i)) {
      groupHasUnbounded[groupHasUnbounded.length - 1] = true
    }
  }
  return false
}

/** Characters probed to decide whether two atoms can match the same text: Latin, Latin-1/Extended, and the Arabic block. */
const SAMPLE: string[] = []
for (let c = 0; c < 384; c++) SAMPLE.push(String.fromCharCode(c))
for (let c = 0x600; c <= 0x6ff; c++) SAMPLE.push(String.fromCharCode(c))

const atomCache = new Map<string, Set<string> | null>()

/**
 * The sample characters one atom (`\d`, `[\d,]`, `.`, `x`) matches, without whitespace; null when it cannot be compiled.
 * Whitespace is left out because {@link squeezeWhitespace} removes the long runs that would make it ambiguous.
 */
function charsOf(atom: string): Set<string> | null {
  if (atomCache.has(atom)) return atomCache.get(atom)!
  let chars: Set<string> | null
  try {
    const re = new RegExp(`^(?:${atom})$`, 's')
    chars = new Set(SAMPLE.filter((c) => !/\s/.test(c) && re.test(c)))
  } catch {
    chars = null
  }
  atomCache.set(atom, chars)
  return chars
}

function overlaps(a: Set<string> | null, b: Set<string> | null): boolean {
  if (!a || !b) return true
  const [small, large] = a.size <= b.size ? [a, b] : [b, a]
  for (const c of small) if (large.has(c)) return true
  return false
}

interface Quantifier {
  length: number
  unbounded: boolean
  optional: boolean
}

function quantifierAt(p: string, i: number): Quantifier {
  let q: Quantifier | null = null
  if (p[i] === '*') q = { length: 1, unbounded: true, optional: true }
  else if (p[i] === '+') q = { length: 1, unbounded: true, optional: false }
  else if (p[i] === '?') q = { length: 1, unbounded: false, optional: true }
  else if (p[i] === '{') {
    const m = /^\{(\d+)(,(\d*))?\}/.exec(p.slice(i, i + 16))
    if (m) q = { length: m[0].length, unbounded: m[2] !== undefined && m[3] === '', optional: Number(m[1]) === 0 }
  }
  if (!q) return { length: 0, unbounded: false, optional: false }
  return p[i + q.length] === '?' ? { ...q, length: q.length + 1 } : q
}

const GROUP_PREFIX = /^\?(?:[:=!]|<[=!]|<[A-Za-z_]\w*>)/

/** Walks the pattern once, tracking the run of unbounded atoms that can match the same characters. */
function isAmbiguous(p: string): boolean {
  let last: Set<string> | null | undefined
  let run = 0
  let wildcards = 0
  for (let i = 0; i < p.length; ) {
    const c = p[i]
    let atom: string
    if (c === '\\') {
      if (p[i + 1] === 'b' || p[i + 1] === 'B') { i += 2; continue }
      atom = p.slice(i, i + 2)
      i += 2
    } else if (c === '[') {
      let j = i + 1
      while (j < p.length && p[j] !== ']') j += p[j] === '\\' ? 2 : 1
      atom = p.slice(i, j + 1)
      i = j + 1
    } else if (c === '(') {
      i += 1
      if (p[i] === '?') i += GROUP_PREFIX.exec(p.slice(i, i + 40))?.[0].length ?? 1
      continue
    } else if (c === ')') {
      i += 1
      const q = quantifierAt(p, i)
      i += q.length
      if (q.length > 0) { last = undefined; run = 0 }
      continue
    } else if (c === '|') {
      last = undefined
      run = 0
      i += 1
      continue
    } else if (c === '^' || c === '$') {
      i += 1
      continue
    } else {
      atom = c === '.' ? '.' : c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      i += 1
    }
    const q = quantifierAt(p, i)
    i += q.length
    const chars = charsOf(atom)
    if (q.unbounded) {
      if (atom === '.' && ++wildcards > MAX_WILDCARDS) return true
      run = last !== undefined && overlaps(last, chars) ? run + 1 : 1
      last = chars
      if (run >= MAX_AMBIGUOUS_RUN) return true
    } else if (!q.optional && last !== undefined && !overlaps(last, chars)) {
      last = undefined
      run = 0
    }
  }
  return false
}

const verdicts = new Map<string, boolean>()
const MAX_CACHED_PATTERNS = 500

export function isSafeRegexPattern(pattern: string): boolean {
  if (pattern.length > MAX_REGEX_PATTERN_CHARS) return false
  const known = verdicts.get(pattern)
  if (known !== undefined) return known
  const safe = !hasNestedQuantifier(pattern) && !isAmbiguous(pattern)
  if (verdicts.size >= MAX_CACHED_PATTERNS) verdicts.clear()
  verdicts.set(pattern, safe)
  return safe
}
