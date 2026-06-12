/**
 * Single path for emitting a notification: insert an idempotent row into
 * `notifications` (deduped by `dedupe_key`) and, only when the row is newly
 * created, fan out an OS push to all of the user's devices. Callers pass already
 * localized `title`/`body`.
 *
 * NB: the live `notifications` schema uses `message` (body), `is_read`, and a
 * `type` enum that is the SEVERITY ('info'|'warning'|'success'|'error'). The
 * notification CATEGORY (e.g. 'recurring_due', 'sms_expense') lives in
 * `metadata.category`.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { sendNativePush } from '@/lib/server/sendNativePush'

export type NotificationSeverity = 'info' | 'warning' | 'success' | 'error'

export interface EmitNotificationArgs {
  userId: string
  /** Logical category, stored in metadata.category (the DB `type` is severity). */
  category: string
  severity: NotificationSeverity
  /** Stable key — a duplicate (user_id, dedupe_key) is a no-op. */
  dedupeKey: string
  title: string
  body: string
  metadata?: Record<string, unknown>
  /** Push payload; pass `false` to insert the row without sending OS push. */
  push?: { data?: Record<string, string>; collapseKey?: string } | false
}

export async function emitNotification(
  service: SupabaseClient,
  args: EmitNotificationArgs,
): Promise<{ created: boolean }> {
  const { data, error } = await service
    .from('notifications')
    .insert({
      user_id: args.userId,
      type: args.severity,
      title: args.title,
      message: args.body,
      metadata: { category: args.category, ...args.metadata },
      dedupe_key: args.dedupeKey,
      is_read: false,
    })
    .select('id')
    .single()

  if (error) {
    // 23505 = unique violation on (user_id, dedupe_key) → already emitted.
    if (error.code === '23505') return { created: false }
    console.error('[emitNotification] insert failed', error)
    return { created: false }
  }
  if (!data) return { created: false }

  if (args.push !== false) {
    try {
      await sendNativePush({
        userId: args.userId,
        title: args.title,
        body: args.body,
        data: args.push?.data,
        collapseKey: args.push?.collapseKey,
      })
    } catch (e) {
      console.error('[emitNotification] push failed', e)
    }
  }
  return { created: true }
}
