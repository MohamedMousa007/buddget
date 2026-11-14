/**
 * Which bank a message is from, when the phone did not say (docs/launch/S1-sms-audit.md 6c, part 1).
 *
 * iPhone hands over the text and nothing about the sender, so the bank is worked out in stages, most certain first,
 * and the stage that named it is recorded:
 *   sender   the transport sender id (Android)
 *   pattern  a code-shipped pattern that is specific to one bank
 *   body     a bank name or hotline the message itself prints, read before masking
 *   account  the digits name an account this user has confirmed, whose name carries the bank (the user's own answer)
 *   history  this user's own messages: the same digits have only ever been seen with one bank
 *   format   other users' messages of the same shape: only ever from one bank, with enough distinct users
 * Anything weaker (a format seen with too few users, or the AI's guess) is a SUGGESTION: it pre-fills the question
 * put to the user and never sets the bank. One user's messages or answers never decide another user's result until
 * the distinct-user threshold is met with nothing contradicting.
 */
import type { ServiceClient } from '@/lib/supabase/service'
import { decomposePaymentMethodName, resolvePaymentBrandKey } from '@/lib/payment/paymentMethodDefaults'
import { digitsOf, matchByTail } from '@/lib/accounts/identity/accountRef'
import { providerFromBody } from './providerFromBody'

export type ProviderStage = 'sender' | 'pattern' | 'body' | 'account' | 'history' | 'format'

/** Stages whose answer may be used as evidence for another message. `history` and `format` are derived, so they never feed themselves. */
const EVIDENCE_STAGES: ReadonlySet<string> = new Set(['sender', 'pattern', 'body', 'account'])

export interface ProviderDecision {
  /** The bank, when a stage is sure enough to act on. */
  bankKey: string | null
  stage: ProviderStage | null
  /** A bank that may only pre-fill the question to the user. */
  suggestion: string | null
  suggestionSource: 'format' | 'ai' | null
}

/** Digits needed before a user's history may name the bank: fewer and two banks can print the same tail. */
export const MIN_HISTORY_DIGITS = 4
/** Distinct users that must agree, with none contradicting, before a format names the bank for someone else. */
export const MIN_FORMAT_USERS = 3

/** Kinds whose message routinely names a SECOND bank: the cash machine's owner, or the other side of a transfer. */
const NAMES_ANOTHER_BANK: ReadonlySet<string> = new Set(['atm_withdrawal', 'instant_transfer_in', 'instant_transfer_out', 'own_transfer', 'cc_payoff', 'currency_exchange'])
/** A name this early in the message is the sender signing it ("BANK: ..."), whatever the kind. */
const SIGNATURE_WITHIN = 12

/** A hotline is always the sender. A bank name is, unless the message is of a kind that names another bank too and the name is not its opening signature. */
export function bodyNameIsTheSender(found: { via: 'hotline' | 'name'; at: number }, kind: string | null | undefined): boolean {
  return found.via === 'hotline' || found.at < SIGNATURE_WITHIN || !NAMES_ANOTHER_BANK.has(kind ?? '')
}

export interface ProviderEvidence {
  sender: string | null | undefined
  body: string
  /** The parsed kind, when known. */
  kind?: string | null
  /** True when a code-shipped, bank-specific pattern parsed the message. */
  fromCodePattern: boolean
  /** The bank name the parser returned (a literal on a code pattern; a guess on the AI and learned-template tiers). */
  parsedBankName: string | null | undefined
  /** The bank of the confirmed account of this user that the digits name, when there is exactly one. */
  accountBank?: string | null
  /** Banks this user's same digits were seen with, from evidence stages only. */
  historyBanks: readonly string[]
  /** Distinct users per bank for this message's format, from evidence stages only. */
  formatVotes: Readonly<Record<string, number>>
}

export function decideProvider(e: ProviderEvidence): ProviderDecision {
  const named = (bankKey: string, stage: ProviderStage): ProviderDecision => ({ bankKey, stage, suggestion: null, suggestionSource: null })
  const bySender = resolvePaymentBrandKey(e.sender)
  if (bySender) return named(bySender, 'sender')
  const parsed = resolvePaymentBrandKey(e.parsedBankName)
  if (e.fromCodePattern && parsed) return named(parsed, 'pattern')
  const inBody = providerFromBody(e.body)
  if (inBody && bodyNameIsTheSender(inBody, e.kind)) return named(inBody.brandId, 'body')
  // The user's own confirmed account is their answer to "which bank is this": it outranks anything inferred.
  if (e.accountBank) return named(e.accountBank, 'account')
  // A second bank for the same digits drops the mapping: nothing is named until the user says which.
  const history = [...new Set(e.historyBanks)]
  if (history.length === 1) return named(history[0], 'history')

  const votes = Object.entries(e.formatVotes).filter(([, users]) => users > 0).sort((a, b) => b[1] - a[1])
  if (votes.length === 1 && votes[0][1] >= MIN_FORMAT_USERS) return named(votes[0][0], 'format')
  if (votes.length === 1) return { bankKey: null, stage: null, suggestion: votes[0][0], suggestionSource: 'format' }
  // The AI's reading is a guess: it may pre-fill the question, never answer it.
  if (parsed && votes.length === 0) return { bankKey: null, stage: null, suggestion: parsed, suggestionSource: 'ai' }
  return { bankKey: null, stage: null, suggestion: null, suggestionSource: null }
}

export interface EvidenceRow { user_id?: string | null; sender: string | null; bank_name: string | null; bank_source: string | null; pattern_id: string | null }

/**
 * The bank a stored row vouches for, or null when its bank was itself derived or guessed. Rows from before the stage
 * was recorded count only when the sender or a code pattern named the bank.
 */
export function evidenceBank(r: EvidenceRow): string | null {
  const bySender = resolvePaymentBrandKey(r.sender)
  if (bySender) return bySender
  const trusted = r.bank_source ? EVIDENCE_STAGES.has(r.bank_source) : !!r.pattern_id
  return trusted ? resolvePaymentBrandKey(r.bank_name) : null
}

export function historyBanksFrom(rows: readonly EvidenceRow[]): string[] {
  return [...new Set(rows.map(evidenceBank).filter((b): b is string => !!b))]
}

/** Distinct users per bank. `exceptUser` is left out, so a user is never their own cross-user evidence. */
export function formatVotesFrom(rows: readonly EvidenceRow[], exceptUser: string): Record<string, number> {
  const users: Record<string, Set<string>> = {}
  for (const r of rows) {
    const bank = evidenceBank(r)
    if (!bank || !r.user_id || r.user_id === exceptUser) continue
    ;(users[bank] ??= new Set()).add(r.user_id)
  }
  return Object.fromEntries(Object.entries(users).map(([bank, set]) => [bank, set.size]))
}

export interface AccountRow { id: string; name: string | null; last4: string | null; last4_aliases?: string[] | null; provisional?: boolean | null }

/** The bank in the name of the one CONFIRMED account these digits name. A provisional account is not the user's answer yet. */
export function accountBankFrom(accounts: readonly AccountRow[], tail: string): string | null {
  const confirmed = accounts.filter((a) => !a.provisional)
  const hit = matchByTail(confirmed.map((a) => ({ id: a.id, last4: a.last4, last4Aliases: a.last4_aliases })), tail)
  const account = hit.id ? confirmed.find((a) => a.id === hit.id) : undefined
  if (!account?.name) return null
  return resolvePaymentBrandKey(decomposePaymentMethodName(account.name.trim(), account.last4 ?? undefined).provider)
}

const COLUMNS = 'user_id, sender, bank_name, bank_source, pattern_id'

/** Runs the cascade for one message. Never throws: a failed lookup only means that stage has nothing to say. */
export async function resolveProvider(
  service: ServiceClient,
  i: { userId: string; sender: string | null | undefined; body: string; kind?: string | null; fromCodePattern: boolean; parsedBankName: string | null | undefined; tail: string | null | undefined; formatKey: string | null },
): Promise<ProviderDecision> {
  const base = { sender: i.sender, body: i.body, kind: i.kind, fromCodePattern: i.fromCodePattern, parsedBankName: i.parsedBankName }
  const quick = decideProvider({ ...base, historyBanks: [], formatVotes: {} })
  if (quick.stage) return quick
  const tail = digitsOf(i.tail)
  let historyBanks: string[] = []
  let formatVotes: Record<string, number> = {}
  let accountBank: string | null = null
  try {
    const [history, format, accounts] = await Promise.all([
      tail.length >= MIN_HISTORY_DIGITS
        ? service.from('sms_parse_log').select(COLUMNS).eq('user_id', i.userId).eq('account_last4', tail).eq('parsed_ok', true).eq('is_duplicate', false).limit(200)
        : Promise.resolve({ data: [] as EvidenceRow[] }),
      i.formatKey
        ? service.from('sms_parse_log').select(COLUMNS).eq('format_key', i.formatKey).eq('parsed_ok', true).eq('is_duplicate', false).neq('user_id', i.userId).limit(500)
        : Promise.resolve({ data: [] as EvidenceRow[] }),
      tail.length >= MIN_HISTORY_DIGITS
        ? service.from('payment_methods').select('id, name, last4, last4_aliases, provisional').eq('user_id', i.userId).is('deleted_at', null)
        : Promise.resolve({ data: [] }),
    ])
    accountBank = accountBankFrom((accounts.data ?? []) as AccountRow[], tail)
    historyBanks = historyBanksFrom((history.data ?? []) as EvidenceRow[])
    formatVotes = formatVotesFrom((format.data ?? []) as EvidenceRow[], i.userId)
  } catch (e) {
    console.warn('[sms/provider] evidence lookup failed', e)
  }
  return decideProvider({ ...base, accountBank, historyBanks, formatVotes })
}
