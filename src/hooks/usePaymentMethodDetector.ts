'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { resolvePaymentBrandKey } from '@/lib/payment/paymentMethodDefaults'
import { paymentTypeFromSms } from '@/lib/payment/smsPaymentType'
import type { PaymentMethodType } from '@/lib/store/types'
import { useShallow } from 'zustand/react/shallow'

export interface DetectedAccount {
  /** Best provider token — SMS sender ID ("QNB EGYPT") or parsed bank name. Bare provider, never composed with the last4. */
  provider: string | null
  last4: string
  /** Type implied by the SMS, else null (the sheet falls back to the brand's type). */
  type: PaymentMethodType | null
}

/** Most frequent non-empty value, else null. */
function mode(values: (string | null)[]): string | null {
  const counts: Record<string, number> = {}
  for (const v of values) if (v) counts[v] = (counts[v] ?? 0) + 1
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
}

/**
 * Best provider token for a detected account. Many banks omit their own name
 * from the SMS body, so the sender ID is often the only institution signal —
 * prefer it whenever the brand catalogue recognises it. 'Bank' is the
 * generic-pattern placeholder, not a real provider; a numeric sender is a
 * shortcode, not a name.
 */
export function pickProvider(sender: string | null, bankName: string | null): string | null {
  const namedBank = bankName && bankName !== 'Bank' ? bankName : null
  const namedSender = sender && !/^\d+$/.test(sender) ? sender : null
  return (
    (namedSender && resolvePaymentBrandKey(namedSender) ? namedSender : null) ??
    namedBank ??
    namedSender
  )
}

type Row = {
  account_last4: string | null
  bank_name: string | null
  sender: string | null
  payment_instrument: string | null
  raw_body: string | null
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
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    void createClient()
      .from('sms_parse_log')
      .select('account_last4, bank_name, sender, payment_instrument, raw_body')
      .eq('parsed_ok', true)
      .not('account_last4', 'is', null)
      .gte('created_at', since)
      .then(({ data }) => {
        if (!data) return
        const linked = new Set(
          paymentMethods.filter((pm) => pm.last4).map((pm) => pm.last4!),
        )
        const groups = new Map<string, Row[]>()
        for (const row of data as Row[]) {
          const l4 = row.account_last4!
          if (!groups.has(l4)) groups.set(l4, [])
          groups.get(l4)!.push(row)
        }
        const result: DetectedAccount[] = []
        for (const [l4, rows] of groups) {
          if (linked.has(l4)) continue
          const provider = pickProvider(
            mode(rows.map((r) => r.sender)),
            mode(rows.map((r) => r.bank_name)),
          )
          // Most frequent inference across this account's messages — one oddly
          // worded SMS shouldn't decide the type.
          const type = mode(
            rows.map((r) => paymentTypeFromSms(r.raw_body, r.payment_instrument)),
          ) as PaymentMethodType | null
          result.push({ last4: l4, provider, type })
        }
        setDetected(result)
      })
  }, [smsEnabled, paymentMethods])

  return detected
}
