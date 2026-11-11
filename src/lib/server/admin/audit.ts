import type { ServiceClient } from '@/lib/supabase/service'
import type { Json } from '@/lib/supabase/database.types'

export interface AuditEntry {
  actorId: string | null
  actorEmail: string | null
  action: string
  targetType?: string
  targetId?: string
  summary?: string
  metadata?: Record<string, unknown>
  ip?: string | null
}

/**
 * Appends to the audit log. Logging never blocks the action it records, so a failure is reported, not thrown: callers
 * that release personal data (`dsr.export`, `pii.*` reads) check the returned flag and refuse when it is false.
 */
export async function writeAudit(service: ServiceClient, entry: AuditEntry): Promise<boolean> {
  const { error } = await service.from('admin_audit_log').insert({
    actor_id: entry.actorId,
    actor_email: entry.actorEmail,
    action: entry.action,
    target_type: entry.targetType ?? null,
    target_id: entry.targetId ?? null,
    summary: entry.summary ?? null,
    metadata: (entry.metadata ?? {}) as Json,
    ip: entry.ip ?? null,
  })
  if (error) console.error('[admin/audit] write failed', entry.action, error.message)
  return !error
}

export const AUDIT_REFUSAL = 'The audit trail could not be written, so nothing was released. Try again.'
