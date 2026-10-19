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

/** Appends to the audit log. Logging must never block the action it records, so failures are reported, not thrown. */
export async function writeAudit(service: ServiceClient, entry: AuditEntry): Promise<void> {
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
}
