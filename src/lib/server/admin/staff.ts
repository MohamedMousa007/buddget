import type { User } from '@supabase/supabase-js'
import type { ServiceClient } from '@/lib/supabase/service'
import { OWNER_EMAIL, OWNER_ROLE, resolvePermissions } from '@/lib/admin/permissions'

export interface StaffMember {
  id: string
  email: string
  user_id: string | null
  display_name: string | null
  department: string | null
  role_key: string
  extra_permissions: string[]
  status: 'active' | 'suspended'
  invited_by: string | null
  last_login_at: string | null
}

export interface StaffContext {
  staff: StaffMember
  role: { key: string; name: string; rank: number }
  permissions: Set<string>
}

const STAFF_COLUMNS = 'id, email, user_id, display_name, department, role_key, extra_permissions, status, invited_by, last_login_at'

/**
 * Staff emails are stored lowercase and matched exactly: a pattern match (`ilike`) would treat `_` and `%` in an
 * address as wildcards and let a different account claim someone else's invitation.
 *
 * Resolves the staff record for a signed-in account, or null when the account is not staff.
 * Invited staff are matched by confirmed email on their first visit and bound to the account.
 */
export async function resolveStaff(service: ServiceClient, user: User): Promise<StaffContext | null> {
  const email = user.email?.toLowerCase()
  if (!email || !user.email_confirmed_at) return null

  let { data: staff } = await service.from('admin_staff').select(STAFF_COLUMNS).eq('user_id', user.id).maybeSingle()

  if (!staff) {
    const { data: invited } = await service.from('admin_staff').select(STAFF_COLUMNS).eq('email', email).is('user_id', null).maybeSingle()
    if (invited) {
      const { data: claimed } = await service
        .from('admin_staff')
        .update({ user_id: user.id })
        .eq('id', invited.id)
        .is('user_id', null)
        .select(STAFF_COLUMNS)
        .single()
      staff = claimed
    }
  }

  if (!staff && email === OWNER_EMAIL) {
    const { data: created } = await service
      .from('admin_staff')
      .insert({ email, user_id: user.id, role_key: OWNER_ROLE, display_name: 'Owner' })
      .select(STAFF_COLUMNS)
      .single()
    staff = created
  }

  if (!staff) return null

  const { data: role } = await service.from('admin_roles').select('key, name, rank, permissions').eq('key', staff.role_key).single()
  if (!role) return null

  return {
    staff: staff as StaffMember,
    role: { key: role.key, name: role.name, rank: role.rank },
    permissions: resolvePermissions(role.key, role.permissions, staff.extra_permissions),
  }
}
