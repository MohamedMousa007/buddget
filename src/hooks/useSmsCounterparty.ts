'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Who a transaction parsed from SMS came from — the payer/merchant the parser read, else
 * the bank or sender ID. Null while loading, offline, or for non-SMS rows.
 */
export function useSmsCounterparty(smsLogId: string | null | undefined): string | null {
  const [found, setFound] = useState<{ id: string; name: string | null } | null>(null)
  useEffect(() => {
    if (!smsLogId) return
    let live = true
    void createClient()
      .from('sms_parse_log')
      .select('merchant, bank_name, sender')
      .eq('id', smsLogId)
      .maybeSingle()
      .then(({ data }) => {
        if (live) setFound({ id: smsLogId, name: data ? (data.merchant ?? data.bank_name ?? data.sender ?? null) : null })
      })
    return () => {
      live = false
    }
  }, [smsLogId])
  return found && found.id === smsLogId ? found.name : null
}
