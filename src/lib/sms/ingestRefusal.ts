import type { ServiceClient } from '@/lib/supabase/service'

export type IngestRefusal = 'device_blocked' | 'invalid_body' | 'invalid_json'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * A refusal before the claim row exists leaves no trace, so a message the server keeps turning away looks like it never
 * arrived. One failed row per (message, reason) makes it visible to staff; the unique (user_id, sms_hash) index makes a
 * retry a no-op. Without an event id the retry cannot be told apart, so nothing is written.
 */
export async function recordIngestRefusal(
  service: ServiceClient,
  caller: { userId: string; deviceId: string | null },
  request: Request,
  code: IngestRefusal,
): Promise<void> {
  const eventId = request.headers.get('x-sms-event-id') ?? ''
  if (!UUID_RE.test(eventId)) return
  const now = new Date().toISOString()
  try {
    await service.from('sms_parse_log').insert({
      user_id: caller.userId,
      source: 'sms',
      status: 'failed',
      failure_code: code,
      parsed_ok: false,
      sms_hash: `refused:${code}:${eventId}`,
      parsed_at: now,
      received_at: now,
      device_id: caller.deviceId,
    })
  } catch (e) {
    console.error('[sms/parse] refusal record failed', e)
  }
}
