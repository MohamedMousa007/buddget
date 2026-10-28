import type { ServiceClient } from '@/lib/supabase/service'
import { removeAvatarObject, stampDataReset, wipeUserData } from '@/lib/server/userData'

export interface DeleteOptions {
  /**
   * Self-service deletion by someone who is also staff. The sign-in is shared with the admin portal, so the app
   * account is emptied (data, profile answers, push and SMS pairing) but the sign-in and every admin record
   * (staff row, credentials, sessions, biometrics) stay exactly as they were.
   */
  keepStaffAccess?: boolean
}

export type DeleteResult =
  | { ok: true; partialErrors: string[]; keptStaffAccess: boolean }
  | { ok: false; error: string; details: string[] }

/**
 * Permanently deletes a user and every piece of data Buddget holds for them.
 *
 * There are no `auth.users` FKs on the public tables (they only store `user_id`), so cascade-on-auth-delete
 * doesn't clean them up. Each user-scoped table is deleted explicitly, children first, and the auth user last.
 * Shared by the self-service route and the admin portal so both stay identical.
 */
export async function deleteUserCompletely(admin: ServiceClient, uid: string, opts: DeleteOptions = {}): Promise<DeleteResult> {
  const { data: staff } = await admin.from('admin_staff').select('role_key').eq('user_id', uid).maybeSingle()

  if (staff && opts.keepStaffAccess) {
    // Deleting the auth user would cascade into admin_staff, admin_credentials, admin_sessions and the biometric devices.
    const errors = [...(await wipeUserData(admin, uid)), ...(await removeAvatarObject(admin, uid)), ...(await stampDataReset(admin, uid))]
    await admin.from('sms_ingest_tokens').update({ is_active: false }).eq('user_id', uid)
    await admin.from('push_tokens').delete().eq('user_id', uid)
    return { ok: true, partialErrors: errors, keptStaffAccess: true }
  }

  // The owner row is protected by a database trigger, so deleting that auth user would fail only after
  // the data below had already been wiped. Refuse up front.
  if (staff?.role_key === 'owner') return { ok: false, error: 'The owner account cannot be deleted', details: [] }

  const errors = await wipeUserData(admin, uid)

  // profiles.id === user_id (no user_id column).
  {
    const { error } = await admin.from('profiles').delete().eq('id', uid)
    if (error) errors.push(`profiles: ${error.message}`)
  }

  // Finally the auth user itself — revokes all sessions.
  const { error: delUserErr } = await admin.auth.admin.deleteUser(uid)
  if (delUserErr) {
    errors.push(`auth.users: ${delUserErr.message}`)
    return { ok: false, error: 'Failed to delete auth user', details: errors }
  }
  return { ok: true, partialErrors: errors, keptStaffAccess: false }
}
