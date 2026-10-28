/**
 * Curated pattern matcher — Tier 1 of the regex-first parse pipeline.
 *
 * Sender-first routing: the institution whose sender IDs match is tried
 * first; remaining sets are tried after (sender IDs drift between carriers).
 * Returns a fully-normalized CuratedMatch or null to fall through to the
 * learned-template / AI tiers.
 */

import { parseLocalizedAmount } from '@/lib/ui/amountParse'
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

function tryPattern(message: string, set: BankPatternSet, p: CuratedPattern): CuratedMatch | null {
  if (!p.verified) return null
  const m = p.regex.exec(message)
  if (!m) return null

  const currency = (p.groups.currency ? m[p.groups.currency] : null)?.toUpperCase()
    ?? p.currencyLiteral ?? 'EGP'
  const amount = parseLocalizedAmount(m[p.groups.amount] ?? '', currency)
  if (!amount || !Number.isFinite(amount)) return null
  const counterparty = p.groups.counterparty ? (m[p.groups.counterparty]?.trim() ?? null) : null
  const last4Raw = p.groups.last4 ? (m[p.groups.last4] ?? null) : null
  const last4 = last4Raw ? last4Raw.replace(/\D/g, '').slice(-4) || null : null
  const cpLast4Raw = p.groups.counterpartyLast4 ? (m[p.groups.counterpartyLast4] ?? null) : null
  const counterpartyLast4 = cpLast4Raw ? cpLast4Raw.replace(/\D/g, '').slice(-4) || null : null
  const txDay = parseSmsDay(p.groups.datetime ? (m[p.groups.datetime] ?? null) : null)

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

export function matchCuratedPattern(message: string, sender: string | null): CuratedMatch | null {
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
      const match = tryPattern(message, set, pattern)
      if (match) return match
    }
  }
  return null
}
