import { buildIssue, createLinearIssue, linearConfig, type IssuePayload } from '@/lib/integrations/linear'
import type { ServiceClient } from '@/lib/supabase/service'

/** After this many tries a row stops retrying and waits for a person (the portal lists dead rows). */
export const MAX_ATTEMPTS = 6

/**
 * Sends due outbox rows to Linear. Safe to run from a cron, from a request's `after()`, or both at once: rows are
 * claimed in SQL with SKIP LOCKED, and a failure only schedules a later retry. Returns how many were sent.
 */
export async function drainOutbox(service: ServiceClient, apiKey: string | undefined, limit = 10): Promise<number> {
  if (!apiKey) return 0
  const { data: rows } = await service.rpc('integration_outbox_claim', { p_limit: limit })
  let sent = 0
  for (const row of rows ?? []) {
    const result = await createLinearIssue(apiKey, buildIssue(row.payload as unknown as IssuePayload, linearConfig()))
    if (result.ok) {
      await service.from('integration_outbox').update({ status: 'sent', sent_at: new Date().toISOString(), last_error: null }).eq('id', row.id)
      if (row.ticket_id) await service.from('support_tickets').update({ linear_issue_id: result.identifier, linear_issue_url: result.url }).eq('id', row.ticket_id)
      sent++
    } else {
      await service.from('integration_outbox').update({ status: row.attempts >= MAX_ATTEMPTS ? 'dead' : 'failed', last_error: result.error }).eq('id', row.id)
    }
  }
  return sent
}
