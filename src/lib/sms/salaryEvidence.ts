/**
 * Evidence score for "is this credit the user's salary?". Amount and payday alone cannot tell a
 * paycheck from a friend paying back exactly the same sum, so wording and who sent it weigh in.
 * Pure: matchSalary gathers the inputs, this only scores them.
 */

/** Auto-link at or above this; below it a plausible match is routed to the confirm push. */
export const SALARY_AUTO_LINK_SCORE = 4

export interface SalaryEvidenceInput {
  body?: string | null
  /** Sender/counterparty as parsed; falls back to the "from <name>" phrase in the body. */
  counterparty?: string | null
  /** Counterparties of credits already linked to this income source. */
  knownCounterparties?: string[]
  /** |credit − salary| / salary, same currency. */
  amountDiff: number
  amount: number
  /** A free payday sits inside the match window. */
  paydayInWindow: boolean
}

export interface SalaryEvidence {
  score: number
  pass: boolean
  signals: string[]
}

const word = (alternation: string) => new RegExp(`(?<![\\p{L}])(?:${alternation})(?![\\p{L}])`, 'iu')

const SALARY_WORDING = word('salary|payroll|wages?|راتب|رواتب|الراتب|الرواتب|مرتب|مرتبات|مرتبى|أجر|أجور|جهة العمل|صاحب العمل')
const REPAY_WORDING = word('repay|loan|gift|lend|borrow|owe|refund|سلف|قرض|هدي[ةه]|عيدي[ةه]|سداد|فلوس|دين')
const IPN_WORDING = /instapay|\bipn\b|instant transfer|transfer(?:red)? from|تحويل لحظي|إنستا|انستا|تحويل من/i
const EMPLOYER_STYLE = /\b(ltd|llc|inc|corp|co|company|technolog\w*|solutions|group|holding|systems|services|software|industries|payroll|hr)\b|شركة|مؤسسة|مجموعة|للتكنولوجيا|للخدمات/i
const FROM_PHRASE = /(?<![\p{L}])(?:transfer(?:red)? from|received from|credited by|from|من)(?:\s*:\s*|\s+)([A-Za-z؀-ۿ][A-Za-z؀-ۿ .'&-]{2,45}?)(?=\s+(?:via|on|at|ref|with|through|عبر|في|بتاريخ)(?![\p{L}])|[.,;:\d\n]|$)/iu
/** Below this the credit is, to within rounding, the expected salary, so a person-shaped sender is the employer or the owner. */
const NEAR_EXACT = 0.005

function tokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z؀-ۿ\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3)
}

export function extractCounterparty(body: string): string | null {
  return FROM_PHRASE.exec(body)?.[1]?.trim() ?? null
}

function sameParty(a: string, b: string): boolean {
  const ta = tokens(a)
  const tb = tokens(b)
  if (!ta.length || !tb.length) return false
  if (ta.join(' ') === tb.join(' ')) return true
  const shared = ta.filter((t) => tb.includes(t)).length
  return shared >= 2
}

/** An all-caps two-word sender ("ACME EGYPT") is a registered name; three words read as a full personal name. */
function looksLikeAllCapsEmployer(name: string): boolean {
  const letters = name.replace(/[^A-Za-z]/g, '')
  return letters.length > 0 && letters === letters.toUpperCase() && tokens(name).length === 2
}

/** Two or three plain words and no company marker reads as an individual. */
function looksLikePerson(name: string): boolean {
  if (EMPLOYER_STYLE.test(name)) return false
  const n = tokens(name).length
  return n >= 2 && n <= 4
}

export function scoreSalaryEvidence(input: SalaryEvidenceInput): SalaryEvidence {
  const body = input.body ?? ''
  const counterparty = input.counterparty?.trim() || extractCounterparty(body)
  const signals: string[] = []
  let score = 0
  const add = (points: number, why: string) => {
    score += points
    signals.push(`${points > 0 ? '+' : ''}${points} ${why}`)
  }

  const salaryWording = SALARY_WORDING.test(body)
  const known = Boolean(counterparty && (input.knownCounterparties ?? []).some((k) => sameParty(k, counterparty)))
  const ipn = IPN_WORDING.test(body)
  const employer = Boolean(counterparty && (EMPLOYER_STYLE.test(counterparty) || looksLikeAllCapsEmployer(counterparty)))

  if (salaryWording) add(3, 'salary wording')
  if (known) add(3, 'counterparty seen on this salary before')
  if (input.paydayInWindow) add(2, 'lands on a payday')
  if (input.amountDiff <= 0.02) add(2, 'amount within 2%')
  if (employer && !known) add(1, 'employer-style sender')

  if (counterparty && !known && !employer && input.amountDiff >= NEAR_EXACT && looksLikePerson(counterparty)) {
    add(-2, 'individual sender not seen on this salary')
    if (ipn) add(-1, 'person-to-person instant transfer')
  }
  if (REPAY_WORDING.test(body) && !salaryWording) add(-3, 'repayment / loan / gift wording')
  if (!salaryWording && !known && ipn && input.amount % 500 === 0) add(-1, 'round person-to-person amount')

  // Amount + payday are the baseline every caller already has (4 points). A body with nothing
  // beyond them, e.g. a friend's exact-sum transfer, must not auto-link; the old no-body call does.
  const hasContext = Boolean(input.body || counterparty)
  const independent = salaryWording || known || employer
  return { score, pass: score >= SALARY_AUTO_LINK_SCORE && (!hasContext || independent), signals }
}
