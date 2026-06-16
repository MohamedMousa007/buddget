/**
 * Curated pattern matcher — Tier 1 of the regex-first parse pipeline.
 *
 * Sender-first routing: the institution whose sender IDs match is tried
 * first; remaining sets are tried after (sender IDs drift between carriers).
 * Returns a fully-normalized CuratedMatch or null to fall through to the
 * learned-template / AI tiers.
 */

import type { BankPatternSet, CuratedMatch, CuratedPattern, SmsKind } from './types'
import { HSBC_PATTERNS } from './hsbc'
import { CIB_PATTERNS } from './cib'
import { NBE_PATTERNS } from './nbe'
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
  VODAFONE_CASH_PATTERNS,
  GENERIC_BANK_PATTERNS,
  // Gulf (GCC) — body-only matches; sender often absent on the iOS bridge.
  EMIRATES_NBD_PATTERNS,
  MASHREQ_PATTERNS,
  SNB_PATTERNS,
]

const MON_TO_NUM: Record<string, string> = {
  JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
  JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12',
}

/**
 * Parses SMS date strings into YYYY-MM-DD.
 * Formats: DD-MM-YYYY, DD/MM/YYYY, DD/MM/YY (Egyptian banks)
 *          DDMMMYY / DDMMMYYYY (e.g. "13JUN26", "13JUN2026" — HSBC Phone Banking)
 */
function parseSmsDay(raw: string | null): string | null {
  if (!raw) return null
  const s = raw.trim()

  // DD-MM-YYYY / DD/MM/YYYY / DD/MM/YY
  let m = /^(\d{2})[-/](\d{2})[-/](\d{2,4})/.exec(s)
  if (m) {
    const [, dd, mm, yy] = m
    const day = Number(dd), month = Number(mm)
    if (day < 1 || day > 31 || month < 1 || month > 12) return null
    const yyyy = yy.length === 2 ? `20${yy}` : yy
    return `${yyyy}-${mm}-${dd}`
  }

  // DDMMMYY / DDMMMYYYY — e.g. "13JUN26" → "2026-06-13"
  m = /^(\d{1,2})([A-Z]{3})(\d{2,4})$/i.exec(s)
  if (m) {
    const [, dd, mon, yy] = m
    const mm = MON_TO_NUM[mon.toUpperCase()]
    if (!mm) return null
    const day = Number(dd)
    if (day < 1 || day > 31) return null
    const yyyy = yy.length === 2 ? `20${yy}` : yy
    return `${yyyy}-${mm}-${dd.padStart(2, '0')}`
  }

  return null
}

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

  const rawAmount = (m[p.groups.amount] ?? '').replace(/,/g, '')
  const amount = parseFloat(rawAmount)
  if (!amount || !Number.isFinite(amount)) return null

  const currency = (p.groups.currency ? m[p.groups.currency] : null)?.toUpperCase()
    ?? p.currencyLiteral ?? 'EGP'
  const counterparty = p.groups.counterparty ? (m[p.groups.counterparty]?.trim() ?? null) : null
  const last4Raw = p.groups.last4 ? (m[p.groups.last4] ?? null) : null
  const last4 = last4Raw ? last4Raw.replace(/\D/g, '').slice(-4) || null : null
  const cpLast4Raw = p.groups.counterpartyLast4 ? (m[p.groups.counterpartyLast4] ?? null) : null
  const counterpartyLast4 = cpLast4Raw ? cpLast4Raw.replace(/\D/g, '').slice(-4) || null : null
  const balanceRaw = p.groups.balance ? (m[p.groups.balance] ?? '').replace(/,/g, '') : ''
  const balance = balanceRaw ? parseFloat(balanceRaw) : null
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
    balance: balance != null && Number.isFinite(balance) ? balance : null,
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
