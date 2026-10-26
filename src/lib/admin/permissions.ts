/**
 * The admin portal's permission model. The DB (`admin_roles`) stores which permissions a role holds;
 * this catalog is the single list of permissions that exist, so a typo in a route guard fails typecheck.
 */

/** The only account that can hold the owner role. Mirrored by the `admin_guard_owner` DB trigger. */
export const OWNER_EMAIL = 'm.mousaofficial@gmail.com'

export const OWNER_ROLE = 'owner'

export const PERMISSIONS = {
  'overview.view': 'See the executive dashboard',
  'analytics.view': 'See growth, engagement and retention analytics',
  'users.view': 'Browse and open user profiles',
  'users.pii': 'See full email, phone and location',
  'users.edit': 'Edit user notes and profile fields',
  'users.limits': 'Change a user’s limits and entitlements',
  'users.suspend': 'Suspend or restore user accounts',
  'users.logs': 'Read a user’s activity, SMS and device logs',
  'financial.request': 'Ask the owner for access to a user’s financial data (one time or permanent; every read is logged)',
  'financial.approve': 'Approve, deny, revoke and exclude financial data access',
  'dsr.manage': 'Export everything held about a person for a data request (needs a reason; every export is logged)',
  'users.tools': 'Run repair tools on a user (tokens, push, sign-out)',
  'users.reset': 'Reset a user’s account: erase all their data and start fresh',
  'users.delete': 'Permanently delete a user',
  'crashes.view': 'See app crashes and errors',
  'crashes.manage': 'Acknowledge and resolve crash reports',
  'sms.view': 'See the SMS pipeline, tracked SMS and the error queue',
  'sms.manage': 'Manage SMS templates and promotion rules',
  'support.view': 'See the support queue',
  'support.reply': 'Reply to and update tickets',
  'support.manage': 'Assign, bulk-edit and delete tickets',
  'billing.view': 'See plans, memberships and trials',
  'billing.manage': 'Create plans and grant or change memberships',
  'loyalty.view': 'See loyalty tiers and balances',
  'loyalty.manage': 'Edit tiers and adjust points',
  'ai.cost.view': 'See AI spend by day, model and feature',
  'ai.cost.manage': 'Edit the AI price book',
  'flags.view': 'See feature flags',
  'flags.manage': 'Change feature flags and rollouts',
  'platform.view': 'See platform health and configuration',
  'platform.manage': 'Change platform configuration (AI limits, maintenance)',
  'emails.view': 'See email templates and the send log',
  'emails.manage': 'Edit, publish and test email templates',
  'staff.view': 'See staff and roles',
  'staff.manage': 'Invite staff and change their roles',
  'audit.view': 'Read the audit log',
  'security.view': 'See sessions and sign-in security events',
} as const

export type Permission = keyof typeof PERMISSIONS

/** Permissions only the owner holds, whatever a role says. */
export const OWNER_ONLY: readonly Permission[] = ['users.delete', 'financial.approve']

export const PERMISSION_KEYS = Object.keys(PERMISSIONS) as Permission[]

export function isPermission(value: string): value is Permission {
  return Object.hasOwn(PERMISSIONS, value)
}

export type PermissionSet = ReadonlySet<string>

/** `*` is the owner's wildcard. */
export function can(perms: PermissionSet, permission: Permission): boolean {
  return perms.has('*') || perms.has(permission)
}

export function canAny(perms: PermissionSet, needed: readonly Permission[]): boolean {
  return needed.some((p) => can(perms, p))
}

/**
 * Effective permissions of a staff member: their role's plus their individual grants.
 * Owner-only permissions are stripped from everyone but the owner.
 */
export function resolvePermissions(roleKey: string, rolePermissions: readonly string[], extra: readonly string[]): Set<string> {
  if (roleKey === OWNER_ROLE) return new Set(['*'])
  const out = new Set<string>()
  for (const p of [...rolePermissions, ...extra]) {
    if (isPermission(p) && !OWNER_ONLY.includes(p)) out.add(p)
  }
  return out
}

/** Can `actorRank` manage someone / something at `targetRank`? Lower rank number = more powerful. */
export function outranks(actorRank: number, targetRank: number): boolean {
  return actorRank < targetRank
}
