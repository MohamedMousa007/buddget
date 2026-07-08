/**
 * Curated SMS pattern library — code-shipped, git-versioned, unit-tested.
 *
 * Tier 1 of the parse pipeline: deterministic regex per institution, applied
 * globally to all users. Patterns ship enabled only when backed by a verified
 * real SMS sample (see docs/SMS_PATTERN_RESEARCH.md).
 */

export type SmsKind =
  | 'purchase' | 'online_purchase' | 'atm_withdrawal'
  | 'instant_transfer_out' | 'instant_transfer_in'
  | 'cc_payoff' | 'own_transfer' | 'currency_exchange'
  | 'income' | 'refund' | 'fee' | 'other'

export type PaymentInstrument = 'card' | 'account' | 'wallet'

/** 1-based regex capture group indices for each extractable field. */
export interface PatternGroups {
  amount: number
  currency?: number
  /** Merchant for purchases; sender/recipient name for transfers. */
  counterparty?: number
  last4?: number
  /** Destination/counterparty account last4 (transfers, FX) for own-account matching. */
  counterpartyLast4?: number
  /** Transaction datetime as DD-MM-YYYY[ HH:mm] (Egyptian bank convention). */
  datetime?: number
}

export interface CuratedPattern {
  /** Stable id logged to sms_parse_log.pattern_id (e.g. 'hsbc-ipn-out'). */
  id: string
  regex: RegExp
  kind: SmsKind
  groups: PatternGroups
  /** Used when the SMS implies the currency without stating it. */
  currencyLiteral?: string
  paymentInstrument?: PaymentInstrument
  /** Only verified patterns (backed by a real SMS sample) are matched. */
  verified: boolean
}

export interface BankPatternSet {
  bank: string
  /** Alphanumeric sender IDs this institution sends from (uppercase). */
  senderIds: string[]
  patterns: CuratedPattern[]
}

/** Normalized result of a curated pattern match. */
export interface CuratedMatch {
  patternId: string
  bank: string
  kind: SmsKind
  amount: number
  currency: string
  /** Merchant (purchases) or transfer counterparty. */
  counterparty: string | null
  last4: string | null
  /** Destination/counterparty account last4 (transfers, FX), else null. */
  counterpartyLast4: string | null
  paymentInstrument: PaymentInstrument | null
  /** Transaction date from the SMS body (YYYY-MM-DD), else null. */
  txDay: string | null
  cleanTitle: string | null
}
