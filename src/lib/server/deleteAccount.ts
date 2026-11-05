import 'server-only'
import type { ServiceClient } from '@/lib/supabase/service'
import { removeAvatarObject, scrubPersonalText, stampDataReset, wipeAccountData, wipeUserData } from '@/lib/server/userData'

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
 * Order matters (C23): the personal text that outlives the account row is scrubbed first, then the auth user is
 * deleted, which cascades through every table with a foreign key to `auth.users` (migration 0203 closed the last
 * gaps). If either step fails the sign-in is still there and nothing is half-gone, so the caller can retry.
 * Only after the account exists no more is an explicit sweep run over the user-keyed tables; whatever it could not
 * remove is returned as `partialErrors`, and the caller must not report that as a clean success.
 * Shared by the self-service route and the admin portal so both stay identical.
 */
export async function deleteUserCompletely(admin: ServiceClient, uid: string, opts: DeleteOptions = {}): Promise<DeleteResult> {
  const { data: staff } = await admin.from('admin_staff').select('role_key').eq('user_id', uid).maybeSingle()
  const { data: authUser } = await admin.auth.admin.getUserById(uid)
  const email = authUser?.user?.email ?? null

  if (staff && opts.keepStaffAccess) {
    // Deleting the auth user would cascade into admin_staff, admin_credentials, admin_sessions and the biometric devices.
    const errors = [
      ...(await wipeUserData(admin, uid)),
      ...(await wipeAccountData(admin, uid, { keepSignIn: true })),
      ...(await scrubPersonalText(admin, uid, email)),
      ...(await removeAvatarObject(admin, uid)),
      ...(await stampDataReset(admin, uid, { blankIdentity: true })),
    ]
    return { ok: true, partialErrors: errors, keptStaffAccess: true }
  }

  // The owner row is protected by a database trigger, so deleting that auth user would fail only after
  // the data below had already been wiped. Refuse up front.
  if (staff?.role_key === 'owner') return { ok: false, error: 'The owner account cannot be deleted', details: [] }

  const scrubErrors = await scrubPersonalText(admin, uid, email)
  if (scrubErrors.length > 0) return { ok: false, error: 'Failed to remove personal text', details: scrubErrors }

  const avatarErrors = await removeAvatarObject(admin, uid)

  // The auth user itself — revokes all sessions and cascades through every FK-linked table.
  const { error: delUserErr } = await admin.auth.admin.deleteUser(uid)
  if (delUserErr) return { ok: false, error: 'Failed to delete auth user', details: [`auth.users: ${delUserErr.message}`] }

  // Sweep for rows without a cascading FK. profiles.id === user_id (no user_id column).
  const errors = [...avatarErrors, ...(await wipeUserData(admin, uid)), ...(await wipeAccountData(admin, uid, { keepSignIn: false }))]
  const { error: profileErr } = await admin.from('profiles').delete().eq('id', uid)
  if (profileErr) errors.push(`profiles: ${profileErr.message}`)
  return { ok: true, partialErrors: errors, keptStaffAccess: false }
}
