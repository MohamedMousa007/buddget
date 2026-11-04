import type { SupabaseClient } from '@supabase/supabase-js'
import { resolvePaymentBrandKey } from '@/lib/payment/paymentMethodDefaults'
import { matchByTail } from '@/lib/accounts/identity/accountRef'

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
  last4_aliases?: string[] | null
  currency: string | null
  parent_id: string | null
  track_sms: boolean | null
  closed_at: string | null
}

const HOLDERS = new Set(['cash', 'bank_account', 'wallet', 'prepaid_card'])

/**
 * The account whose balance a message reports: the method whose digits the message's tail names ("***-001" names the
 * account saved as 0001), or the account behind a debit card. With no usable number the sending provider decides, only
 * when it names exactly one account, using the currency the message states to tell two accounts of one bank apart.
 */
export function resolveReportTarget(
  methods: readonly MethodRow[],
  last4: string | null,
  provider?: { sender?: string | null; bankName?: string | null },
  currency?: string | null,
): MethodRow | null {
  const open = methods.filter((m) => !m.closed_at)
  const byTail = matchByTail(open.map((m) => ({ id: m.id, last4: m.last4, last4Aliases: m.last4_aliases })), last4)
  if (byTail.ambiguous) return null
  const hit = byTail.id ? open.find((m) => m.id === byTail.id) : undefined
  if (!hit) {
    // Wallets often have no last 4: fall back to the sending provider, only when it names exactly one account.
    const brand = resolvePaymentBrandKey(provider?.bankName) ?? resolvePaymentBrandKey(provider?.sender)
    if (!brand) return null
    const same = open.filter((m) => HOLDERS.has(m.type) && resolvePaymentBrandKey(m.name) === brand)
    if (same.length === 1) return same[0]
    const wanted = currency === 'LE' ? 'EGP' : currency
    const sameCurrency = wanted ? same.filter((m) => m.currency === wanted) : []
    return sameCurrency.length === 1 ? sameCurrency[0] : null
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
      .select('id, name, type, last4, last4_aliases, currency, parent_id, track_sms, closed_at').eq('user_id', i.userId).is('deleted_at', null)
    const target = resolveReportTarget((data ?? []) as MethodRow[], i.last4, { sender: i.sender, bankName: i.bankName }, found.currency)
    if (!target) return
    if (found.currency && target.currency && found.currency !== 'LE' && found.currency !== target.currency) return
    const report = {
      user_id: i.userId, payment_method_id: target.id, balance: found.balance, currency: target.currency,
      reported_at: i.receivedAt, source: 'sms', sms_parse_log_id: i.logId,
    }
    // Select-then-write: the unique index on sms_parse_log_id is partial, which `onConflict` cannot target.
    const { data: existing, error: readError } = await i.service.from('account_balance_reports')
      .select('id').eq('sms_parse_log_id', i.logId).maybeSingle()
    if (readError) throw readError
    const { error: writeError } = existing
      ? await i.service.from('account_balance_reports').update(report).eq('id', existing.id)
      : await i.service.from('account_balance_reports').insert(report)
    if (writeError) throw writeError
    const { error: logError } = await i.service.from('sms_parse_log').update({ payment_method_id: target.id, balance_after: found.balance }).eq('id', i.logId)
    if (logError) throw logError
  } catch (e) {
    console.warn('[sms/balance] report failed', e)
  }
}
