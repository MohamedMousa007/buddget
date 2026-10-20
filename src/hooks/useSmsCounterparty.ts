'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const names = new Map<string, string | null>()
let queued = new Set<string>()
let timer: ReturnType<typeof setTimeout> | null = null
const waiting = new Map<string, Array<(name: string | null) => void>>()

/** Rows that ask within a few milliseconds of each other are answered by one query, not one query per row. */
function lookup(id: string): Promise<string | null> {
  if (names.has(id)) return Promise.resolve(names.get(id) ?? null)
  return new Promise((resolve) => {
    waiting.set(id, [...(waiting.get(id) ?? []), resolve])
    queued.add(id)
    timer ??= setTimeout(async () => {
      const ids = [...queued]
      queued = new Set()
      timer = null
      try {
        const { data } = await createClient().from('sms_parse_log').select('id, merchant, bank_name, sender').in('id', ids)
        const found = new Map((data ?? []).map((r) => [r.id, r.merchant ?? r.bank_name ?? r.sender ?? null]))
        for (const key of ids) {
          const name = found.get(key) ?? null
          names.set(key, name)
          for (const done of waiting.get(key) ?? []) done(name)
          waiting.delete(key)
        }
      } catch {
        // Offline or failed: callers show no name for now, and nothing is cached so the next mount asks again.
        for (const key of ids) {
          for (const done of waiting.get(key) ?? []) done(null)
          waiting.delete(key)
        }
      }
    }, 25)
  })
}

/**
 * Who a transaction parsed from SMS came from — the payer/merchant the parser read, else
 * the bank or sender ID. Null while loading, offline, or for non-SMS rows.
 */
export function useSmsCounterparty(smsLogId: string | null | undefined): string | null {
  const [found, setFound] = useState<{ id: string; name: string | null } | null>(null)
  useEffect(() => {
    if (!smsLogId) return
    let live = true
    void lookup(smsLogId).then((name) => {
      if (live) setFound({ id: smsLogId, name })
    })
    return () => {
      live = false
    }
  }, [smsLogId])
  return found && found.id === smsLogId ? found.name : null
}
