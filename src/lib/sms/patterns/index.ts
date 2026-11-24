/**
 * Curated pattern matcher — Tier 1 of the regex-first parse pipeline.
 *
 * Sender-first routing: the institution whose sender IDs match is tried
 * first; remaining sets are tried after (sender IDs drift between carriers).
 * Returns a fully-normalized CuratedMatch or null to fall through to the
 * learned-template / AI tiers.
 */

import { parseLocalizedAmount } from '@/lib/ui/amountParse'
import { CURRENCY_CODES } from './currency'
import type { BankPatternSet, CuratedMatch, CuratedPattern, SmsKind } from './types'
import { HSBC_PATTERNS } from './hsbc'
import { CIB_PATTERNS } from './cib'
import { NBE_PATTERNS } from './nbe'
import { QNB_PATTERNS } from './qnb'
import { VODAFONE_CASH_PATTERNS } from './vodafoneCash'
import { GENERIC_BANK_PATTERNS } from './genericBank'
import { EMIRATES_NBD_PATTERNS } from './emiratesNBD'
import { MASHREQ_PATTERNS } from './mashreq'
import { SNB_PATTERNS } from './snb'
import { CC_PAYOFF_PATTERNS } from './ccPayoff'
import { OWN_TRANSFER_PATTERNS } from './ownTransfer'
import { FX_PATTERNS } from './fx'

export const ALL_PATTERN_SETS: BankPatternSet[] = [
  // Movement-specific sets first — they carry stronger intent signals
  // (e.g. "Credit Card Payment", "FX", own-account transfer) than the
  // generic purchase/transfer patterns below.
  CC_PAYOFF_PATTERNS,
  FX_PATTERNS,
  OWN_TRANSFER_PATTERNS,
  HSBC_PATTERNS,
  CIB_PATTERNS,
  NBE_PATTERNS,
  QNB_PATTERNS,
  VODAFONE_CASH_PATTERNS,
  GENERIC_BANK_PATTERNS,
  // Gulf (GCC) — body-only matches; sender often absent on the iOS bridge.
  EMIRATES_NBD_PATTERNS,
  MASHREQ_PATTERNS,
  SNB_PATTERNS,
]

import { parseSmsDay } from '@/lib/sms/parseSmsDay'
export { parseSmsDay }

function buildCleanTitle(kind: SmsKind, bank: string, counterparty: string | null): string | null {
  switch (kind) {
    case 'atm_withdrawal':       return `ATM Withdrawal — ${bank}`
    case 'cc_payoff':            return `Credit Card Payment — ${bank}`
    case 'own_transfer':         return `Transfer between accounts — ${bank}`
    case 'currency_exchange':    return `Currency Exchange — ${bank}`
    case 'instant_transfer_out': return counterparty ? `Transfer to ${counterparty}` : `Transfer — ${bank}`
    case 'instant_transfer_in':  return counterparty ? `Transfer from ${counterparty}` : `Transfer — ${bank}`
    case 'fee':                  return `Bank Fee — ${bank}`
    case 'refund':               return `Refund — ${counterparty ?? bank}`
    default:                     return counterparty ?? bank
  }
}

function tryPattern(message: string, set: BankPatternSet, p: CuratedPattern, receivedAt: string | null): CuratedMatch | null {
  if (!p.verified) return null
  const m = p.regex.exec(message)
  if (!m) return null

  const rawCurrency = p.groups.currency ? m[p.groups.currency] : null
  if (rawCurrency && rawCurrency !== rawCurrency.toUpperCase() && !(CURRENCY_CODES as readonly string[]).includes(rawCurrency.toUpperCase())) return null
  const currency = rawCurrency?.toUpperCase() ?? p.currencyLiteral ?? 'EGP'
  const amount = parseLocalizedAmount(m[p.groups.amount] ?? '', currency)
  if (!amount || !Number.isFinite(amount)) return null
  const counterparty = p.groups.counterparty ? (m[p.groups.counterparty]?.trim() ?? null) : null
  const last4Raw = p.groups.last4 ? (m[p.groups.last4] ?? null) : null
  const last4 = last4Raw ? last4Raw.replace(/\D/g, '').slice(-4) || null : null
  const cpLast4Raw = p.groups.counterpartyLast4 ? (m[p.groups.counterpartyLast4] ?? null) : null
  const counterpartyLast4 = cpLast4Raw ? cpLast4Raw.replace(/\D/g, '').slice(-4) || null : null
  const txDay = parseSmsDay(p.groups.datetime ? (m[p.groups.datetime] ?? null) : null, receivedAt)

  return {
    patternId: p.id,
    bank: set.bank,
    kind: p.kind,
    amount,
    currency,
    counterparty,
    last4,
    counterpartyLast4,
    paymentInstrument: p.paymentInstrument ?? null,
    txDay,
    cleanTitle: buildCleanTitle(p.kind, set.bank, counterparty),
  }
}

export function normalizeSender(sender: string): string {
  return sender.trim().toUpperCase()
}

function findCurated(message: string, sender: string | null, receivedAt: string | null): { pattern: CuratedPattern; match: CuratedMatch } | null {
  const normalized = sender ? normalizeSender(sender) : null

  // Sender-matched institution first — the strongest routing signal.
  const ordered = normalized
    ? [...ALL_PATTERN_SETS].sort((a, b) => {
        const aHit = a.senderIds.includes(normalized) ? 0 : 1
        const bHit = b.senderIds.includes(normalized) ? 0 : 1
        return aHit - bHit
      })
    : ALL_PATTERN_SETS

  for (const set of ordered) {
    for (const pattern of set.patterns) {
      const match = tryPattern(message, set, pattern, receivedAt)
      if (match) return { pattern, match }
    }
  }
  return null
}

export function matchCuratedPattern(message: string, sender: string | null, receivedAt: string | null = null): CuratedMatch | null {
  return findCurated(message, sender, receivedAt)?.match ?? null
}

/**
 * One message that states several movements in the same curated wording ("debited 100 at UBER … debited 250 at
 * STARBUCKS"), cut into one text per movement, in order. The matcher reads only the first statement, so without this
 * every later one is lost (QA-32). A cut starts where a statement starts, so text before the first one stays with it.
 * Each piece must match the same pattern on its own, or the message is returned whole. One statement: `[message]`.
 */
export function splitCuratedSegments(message: string, sender: string | null, receivedAt: string | null = null): string[] {
  const found = findCurated(message, sender, receivedAt)
  if (!found) return [message]
  const flags = found.pattern.regex.flags.includes('g') ? found.pattern.regex.flags : `${found.pattern.regex.flags}g`
  const starts = [...message.matchAll(new RegExp(found.pattern.regex.source, flags))].map((m) => m.index ?? 0)
  if (starts.length < 2) return [message]
  const segments = starts.map((start, i) => message.slice(i === 0 ? 0 : start, starts[i + 1] ?? message.length).trim())
  const whole = segments.every((s) => findCurated(s, sender, receivedAt)?.pattern.id === found.pattern.id)
  return whole ? segments : [message]
}
