import type { ServiceClient } from '@/lib/supabase/service'

/**
 * Adds flags to the money rows a message owns. For the paths that create their row inside the database (a pairing),
 * where the flags cannot be passed with the insert. Idempotent: a flag already on the row is not added twice, and a row
 * that has them all is not written. Takes `SmsFlag`s and their data entries (`SAME_PHONE_COPY`). Never touches `edited_at`, so it is not a client write.
 */
export async function appendSmsFlags(service: ServiceClient, userId: string, logId: string, flags: readonly string[]): Promise<void> {
  if (flags.length === 0) return
  for (const table of ['expenses', 'income_events'] as const) {
    const { data } = await service.from(table).select('id, sms_flags').eq('user_id', userId).eq('sms_log_id', logId)
    for (const row of (data ?? []) as { id: string; sms_flags: string[] | null }[]) {
      const have = row.sms_flags ?? []
      const missing = flags.filter((f) => !have.includes(f))
      if (missing.length === 0) continue
      const { error } = await service.from(table).update({ sms_flags: [...have, ...missing] }).eq('id', row.id)
      if (error) console.warn('[sms/flags] could not stamp', error.message)
    }
  }
}
