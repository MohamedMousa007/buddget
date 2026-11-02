'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { sharedFetch } from '@/lib/query/sharedFetch'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { PAYMENT_BRANDS, resolvePaymentBrandKey } from '@/lib/payment/paymentMethodDefaults'
import { paymentTypeFromSms } from '@/lib/payment/smsPaymentType'
import type { PaymentMethod, PaymentMethodType } from '@/lib/store/types'
import { useShallow } from 'zustand/react/shallow'
import { answersTo, tailsMatch } from '@/lib/accounts/identity/accountRef'
import { extractBalance } from '@/lib/sms/balanceReport'

export interface DetectedAccount {
  /** Prompt identity; see detectAccounts. */
  key: string
  /** The account's currency when its messages state a balance (that balance is in the account's own currency), else null. */
  currency: string | null
  /** Best provider token — SMS sender ID ("QNB EGYPT") or parsed bank name. Bare provider, never composed with the last4. */
  provider: string | null
  last4: string
  /** Type implied by the SMS, else null (the sheet falls back to the brand's type). */
  type: PaymentMethodType | null
  /** Parsed SMS that mention this account in the lookback week. */
  count: number
}

/** Currency named next to a message's trailing balance; "LE" is the Egyptian pound. */
function balanceCurrency(body: string): string | null {
  const c = extractBalance(body)?.currency
  return c === 'LE' ? 'EGP' : (c ?? null)
}

/** An account seen in messages stays offered this long, so one seen last week is not forgotten. */
const DETECT_LOOKBACK_DAYS = 30

/** Most frequent non-empty value, else null. */
function mode(values: (string | null)[]): string | null {
  const counts: Record<string, number> = {}
  for (const v of values) if (v) counts[v] = (counts[v] ?? 0) + 1
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
}

/**
 * Best provider name for a detected account. Many banks omit their own name from
 * the SMS body, so the sender ID is often the only institution signal — prefer
 * it whenever the brand catalogue recognises it. 'Bank' is the generic-pattern
 * placeholder (GENERIC_BANK_PATTERNS.bank), not a real provider; a numeric
 * sender is a shortcode, not a name.
 *
 * Resolvable tokens come back as the catalogue's canonical name ("QNB EGYPT" →
 * "QNB Alahli") so the banner and the setup sheet — which resolves the name
 * again — always show the same provider.
 */
export function pickProvider(sender: string | null, bankName: string | null): string | null {
  const namedBank = bankName && bankName !== 'Bank' ? bankName : null
  const namedSender = sender && !/^\d+$/.test(sender) ? sender : null
  const best =
    (namedSender && resolvePaymentBrandKey(namedSender) ? namedSender : null) ??
    namedBank ??
    namedSender
  if (!best) return null
  const brandId = resolvePaymentBrandKey(best)
  return brandId ? PAYMENT_BRANDS[brandId].name : best
}

export type Row = {
  account_last4: string | null
  bank_name: string | null
  sender: string | null
  payment_instrument: string | null
  raw_body: string | null
}

/**
 * Groups parsed messages into the accounts they mention, per provider: the same digits at two banks are two accounts, and
 * one account printed as "001" and "0001" is one. Accounts the user already has (by displayed number or alias) are left out.
 * `key` is the prompt identity: the plain `pm:<digits>` it always was, widened with the provider only when two groups
 * share digits, so answers given before keep working.
 */
export function detectAccounts(rows: Row[], methods: readonly PaymentMethod[]): DetectedAccount[] {
  const byProvider = new Map<string, { provider: string | null; rows: Row[] }>()
  for (const row of rows) {
    const provider = pickProvider(row.sender, row.bank_name)
    const k = provider ?? ''
    const g = byProvider.get(k) ?? { provider, rows: [] }
    g.rows.push(row)
    byProvider.set(k, g)
  }
  const found: Omit<DetectedAccount, 'key'>[] = []
  for (const { provider, rows: group } of byProvider.values()) {
    const clusters: { tail: string; rows: Row[] }[] = []
    const tails = [...new Set(group.map((r) => r.account_last4!))].sort((a, b) => b.length - a.length)
    for (const tail of tails) {
      const into = clusters.find((c) => tailsMatch(c.tail, tail))
      const mine = group.filter((r) => r.account_last4 === tail)
      if (into) into.rows.push(...mine)
      else clusters.push({ tail, rows: [...mine] })
    }
    for (const c of clusters) {
      if (methods.some((pm) => answersTo(pm, c.tail))) continue
      // Most frequent inference across this account's messages: one oddly worded SMS shouldn't decide the type.
      const type = mode(c.rows.map((r) => paymentTypeFromSms(r.raw_body, r.payment_instrument))) as PaymentMethodType | null
      const currency = mode(c.rows.map((r) => (r.raw_body ? balanceCurrency(r.raw_body) : null)))
      found.push({ provider, last4: c.tail, type, currency, count: c.rows.length })
    }
  }
  const sharing = (last4: string) => found.filter((f) => f.last4 === last4).length > 1
  return found.map((f) => ({ ...f, key: sharing(f.last4) ? `pm:${resolvePaymentBrandKey(f.provider) ?? f.provider ?? 'unknown'}:${f.last4}` : `pm:${f.last4}` }))
}

export function usePaymentMethodDetector(): DetectedAccount[] {
  const { smsEnabled, paymentMethods } = useFinanceStore(
    useShallow((s) => ({
      smsEnabled: s.settings.smsTrackingEnabled,
      paymentMethods: s.paymentMethods,
    })),
  )
  const [detected, setDetected] = useState<DetectedAccount[]>([])

  useEffect(() => {
    if (!smsEnabled) return
    const since = new Date(Date.now() - DETECT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString()
    void sharedFetch('sms-accounts', 60_000, async () => {
      const { data } = await createClient()
        .from('sms_parse_log')
        .select('account_last4, bank_name, sender, payment_instrument, raw_body')
        .eq('parsed_ok', true)
        .not('account_last4', 'is', null)
        .gte('created_at', since)
        .limit(300)
      return data
    })
      .then((data) => {
        if (!data) return
        setDetected(detectAccounts(data as Row[], paymentMethods))
      })
      .catch(() => undefined)
  }, [smsEnabled, paymentMethods])

  return detected
}
