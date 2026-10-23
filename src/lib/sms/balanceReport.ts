import type { SupabaseClient } from '@supabase/supabase-js'
import { resolvePaymentBrandKey } from '@/lib/payment/paymentMethodDefaults'

const NUM = String.raw`(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)`
const CUR = String.raw`(EGP|SAR|AED|KWD|QAR|OMR|BHD|USD|EUR|GBP|LE)?`
const TRAILING_CUR = String.raw`\s*(?:(EGP|SAR|AED|KWD|QAR|OMR|BHD|USD|EUR|GBP|LE)|جنيه|جنية|جم)?`

/** "available balance" clauses only. Credit cards report a LIMIT, which is not a balance and never matches here. */
const PATTERNS: readonly RegExp[] = [
  new RegExp(String.raw`\b(?:available|current|account|card)\s+balance(?:\s+is)?\s*:?\s*${CUR}\s*${NUM}`, 'i'),
  new RegExp(String.raw`\bavl?\.?\s*bal(?:ance)?\s+(?:is\s+)?${CUR}\s*${NUM}`, 'i'),
  new RegExp(String.raw`(?:الرصيد|رصيدك?|رصيد\s+حسابك)\s*(?:الحالي|المتاح)\s*:?\s*${CUR}\s*${NUM}`, 'i'),
]

const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩'
const latin = (s: string) => s.replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d))).replace(/٫/g, '.').replace(/٬/g, ',')

export interface ExtractedBalance {
  balance: number
  /** Present only when the message names it. */
  currency?: string
}

/** Reads the balance a bank appended to a message. Takes the LAST clause (the trailing balance), never a limit. */
export function extractBalance(body: string): ExtractedBalance | null {
  const text = latin(body)
  let best: { index: number; value: ExtractedBalance } | null = null
  for (const re of PATTERNS) {
    for (const m of text.matchAll(new RegExp(re.source, 'gi'))) {
      const num = parseFloat(m[2].replace(/,/g, ''))
      if (!Number.isFinite(num)) continue
      const idx = m.index ?? 0
      if (!best || idx > best.index) {
        const after = new RegExp(TRAILING_CUR, 'i').exec(text.slice(idx + m[0].length, idx + m[0].length + 8))
        best = { index: idx, value: { balance: num, currency: (m[1] ?? after?.[1])?.toUpperCase() } }
      }
    }
  }
  return best?.value ?? null
}

interface MethodRow {
  id: string
  name: string
  type: string
  last4: string | null
  currency: string | null
  parent_id: string | null
  track_sms: boolean | null
  closed_at: string | null
}

const HOLDERS = new Set(['cash', 'bank_account', 'wallet', 'prepaid_card'])

/** The account whose balance a message reports: the method with that last 4, or the account behind a debit card. */
export function resolveReportTarget(methods: readonly MethodRow[], last4: string | null, provider?: { sender?: string | null; bankName?: string | null }): MethodRow | null {
  const hit = last4 ? methods.find((m) => m.last4 === last4 && !m.closed_at) : undefined
  if (!hit) {
    // Wallets often have no last 4: fall back to the sending provider, only when it names exactly one account.
    const brand = resolvePaymentBrandKey(provider?.bankName) ?? resolvePaymentBrandKey(provider?.sender)
    if (!brand) return null
    const same = methods.filter((m) => HOLDERS.has(m.type) && !m.closed_at && resolvePaymentBrandKey(m.name) === brand)
    return same.length === 1 ? same[0] : null
  }
  if (HOLDERS.has(hit.type)) return hit
  if (hit.type === 'debit_card' && hit.parent_id) return methods.find((m) => m.id === hit.parent_id && HOLDERS.has(m.type) && !m.closed_at) ?? null
  return null
}

export interface BalanceReportInput {
  service: SupabaseClient
  userId: string
  logId: string
  body: string
  amount: number | null
  last4: string | null
  receivedAt: string
  sender?: string | null
  bankName?: string | null
}

/** Records the balance a message reports. Never throws: this runs after the response and must not touch the SMS pipeline. */
export async function recordBalanceReport(i: BalanceReportInput): Promise<void> {
  try {
    const found = extractBalance(i.body)
    if (!found || (i.amount != null && found.balance === i.amount)) return
    const { data } = await i.service.from('payment_methods')
      .select('id, name, type, last4, currency, parent_id, track_sms, closed_at').eq('user_id', i.userId).is('deleted_at', null)
    const target = resolveReportTarget((data ?? []) as MethodRow[], i.last4, { sender: i.sender, bankName: i.bankName })
    if (!target || target.track_sms === false) return
    if (found.currency && target.currency && found.currency !== 'LE' && found.currency !== target.currency) return
    await i.service.from('account_balance_reports').upsert({
      user_id: i.userId, payment_method_id: target.id, balance: found.balance, currency: target.currency,
      reported_at: i.receivedAt, source: 'sms', sms_parse_log_id: i.logId,
    }, { onConflict: 'sms_parse_log_id' })
    await i.service.from('sms_parse_log').update({ payment_method_id: target.id, balance_after: found.balance }).eq('id', i.logId)
  } catch (e) {
    console.warn('[sms/balance] report failed', e)
  }
}
