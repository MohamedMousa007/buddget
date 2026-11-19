/**
 * The name a narrow surface shows: the full name when it fits one line, otherwise the first name (never a last initial).
 * Member cards and the profile screen keep the full name and do not call this.
 */

/** Code-point budgets per surface, tuned against the real widths at 375px. */
export const NAME_BUDGET = { menu: 20, row: 26 } as const

const MAX_FIRST_TOKENS = 3
const EMOJI = /[\p{Extended_Pictographic}\p{Regional_Indicator}‍‌️⃣]/gu
const LATIN_MARKS = /[̀-ͯ]/g
const ARABIC_MARKS = /[ـً-ٰٟ]/g
const EDGE_PUNCT = /^[.,'’`"-]+|[.,'’`"-]+$/g

/** Spelling-insensitive key: lower case, no diacritics or tatweel, one alef. Used for matching only, never shown. */
const key = (token: string) =>
  token.normalize('NFD').replace(LATIN_MARKS, '').replace(ARABIC_MARKS, '').replace(/[أإآٱ]/g, 'ا').replace(EDGE_PUNCT, '').toLowerCase()

/** "Abdel", "Abu", "Umm", "ibn": the next word is part of the same name. */
const PREFIXES = new Set(['abd', 'abdel', 'abdul', 'abdal', 'abdu', 'abu', 'abou', 'umm', 'um', 'ibn', 'bin', 'ben', 'عبد', 'ابو', 'ام', 'ابن', 'بن'])
/** "El", "Al": belongs to the word after it. */
const PARTICLES = new Set(['el', 'al', 'ar', 'as', 'ash', 'ad', 'ed', 'ال'])
/** "Nour El Din": noun + particle + din is one name. */
const DIN = new Set(['din', 'deen', 'الدين'])
const DIN_PARTICLES = new Set(['el', 'al', 'ad', 'ed'])

/** Strips emoji and joiners, collapses spaces. Case and spelling are left as typed. */
export function cleanName(full: string): string {
  return full.replace(EMOJI, ' ').replace(/\s+/g, ' ').trim()
}

/** The first name as written: "Mohamed Ali" → "Mohamed", "Abdel Rahman Ali" → "Abdel Rahman", "Nour El Din Hassan" → "Nour El Din". */
export function firstName(full: string): string {
  const tokens = cleanName(full).split(' ').filter(Boolean)
  if (tokens.length < 2) return tokens[0] ?? ''
  const keys = tokens.map(key)
  const n = tokens.length
  const isParticle = (i: number) => i < n - 1 && PARTICLES.has(keys[i])

  let end = 0
  while (isParticle(end)) end++
  const base = end
  end++
  if (PREFIXES.has(keys[base]) && end < n) {
    while (isParticle(end)) end++
    end++
  }
  if (end < n && keys[end] === 'الدين') end++
  else if (end + 1 < n && DIN_PARTICLES.has(keys[end]) && DIN.has(keys[end + 1])) end += 2
  return tokens.slice(0, Math.min(end, MAX_FIRST_TOKENS)).join(' ')
}

/** Full name if it fits `budget` code points, else the first name. CSS truncation is the last resort for a first name that still overflows. */
export function displayName(full: string, budget: number): string {
  const clean = cleanName(full)
  return [...clean].length <= budget ? clean : firstName(clean)
}
