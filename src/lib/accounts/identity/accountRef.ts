const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩'

/** Digits only, Arabic-Indic digits converted. */
export function digitsOf(value: string | null | undefined): string {
  if (!value) return ''
  return value.replace(/[٠-٩]/g, (d) => String(ARABIC_INDIC.indexOf(d))).replace(/\D/g, '')
}

/** Fewest visible digits that identify anything. Below this a number is noise. */
export const MIN_ACCOUNT_DIGITS = 2
/** Most visible digits a bank prints in a masked number. */
export const MAX_ACCOUNT_DIGITS = 6

/** Empty (no number) or a usable tail. */
export const isSavableTail = (digits: string): boolean =>
  digits.length === 0 || (digits.length >= MIN_ACCOUNT_DIGITS && digits.length <= MAX_ACCOUNT_DIGITS)

/**
 * Two visible tails name the same account when the shorter one is the end of the longer one: a bank that prints
 * "***-001" and a user who saved "0001" mean the same account. Compared as strings, so leading zeros count.
 */
export function tailsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = digitsOf(a)
  const y = digitsOf(b)
  if (x.length < MIN_ACCOUNT_DIGITS || y.length < MIN_ACCOUNT_DIGITS) return false
  return x.length <= y.length ? y.endsWith(x) : x.endsWith(y)
}

export interface Identified { id: string; last4: string | null }

export interface TailMatch {
  /** The one account the tail names, else null. */
  id: string | null
  /** More than one account fits and none is exact: nothing is picked. */
  ambiguous: boolean
}

/** Fewest digits a partial (shorter or longer) tail may share with a saved number before money is attributed on it. */
export const MIN_PARTIAL_DIGITS = 3

/** An exact tail beats a partial one; otherwise exactly one account must fit, and the shared tail must be long enough to trust. */
export function matchByTail(methods: readonly Identified[], captured: string | null | undefined): TailMatch {
  const tail = digitsOf(captured)
  if (tail.length < MIN_ACCOUNT_DIGITS) return { id: null, ambiguous: false }
  const exact = methods.filter((m) => m.last4 !== null && digitsOf(m.last4) === tail)
  if (exact.length === 1) return { id: exact[0].id, ambiguous: false }
  if (exact.length > 1) return { id: null, ambiguous: true }
  const partial = methods.filter((m) => Math.min(digitsOf(m.last4).length, tail.length) >= MIN_PARTIAL_DIGITS && tailsMatch(m.last4, tail))
  if (partial.length === 1) return { id: partial[0].id, ambiguous: false }
  return { id: null, ambiguous: partial.length > 1 }
}

const MASK = String.raw`[*xX•#]`
/** "from 103-104***-001", "Account ********0001", "A/C **207", "ending in 1234", "card no. XXXX1234". */
const CONTEXTS: readonly RegExp[] = [
  new RegExp(String.raw`\bfrom\s+[\d\-\s]*${MASK}{2,}[\-\s]?(\d{2,6})(?!\d)`, 'i'),
  new RegExp(String.raw`\b(?:account|a\/c|acct)\s*(?:no\.?|number)?\s*:?\s*[\d\-]*${MASK}{2,}[\-\s]?(\d{2,6})(?!\d)`, 'i'),
  new RegExp(String.raw`\bending\s+(?:in|with)?\s*${MASK}*\s*(\d{2,6})(?!\d)`, 'i'),
  new RegExp(String.raw`\bcard\s*(?:no\.?|number)?\s*:?\s*${MASK}{2,}[\-\s]?(\d{2,6})(?!\d)`, 'i'),
]

/**
 * The visible tail of the account a message names as its source, for the case where the parser returned nothing.
 * Only phrasings that tie the number to the source are read: a "transfer to ***-001" names the other side.
 */
export function extractAccountTail(body: string): string | null {
  const text = body.replace(/[٠-٩]/g, (d) => String(ARABIC_INDIC.indexOf(d)))
  for (const re of CONTEXTS) {
    const m = re.exec(text)
    if (m) return m[1]
  }
  return null
}
