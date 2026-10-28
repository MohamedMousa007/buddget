import { ADMIN_NAV, type AdminNavGroup } from '../nav'
import { canAny, type Permission, type PermissionSet } from '../permissions'
import { SMS_TABS } from '../smsTabs'
import { rankEntries } from './rank'

export const SEARCH_GROUPS = ['Pages', 'Users', 'Support', 'SMS', 'Analytics', 'Billing', 'Emails', 'Team', 'Settings'] as const
export type SearchGroup = (typeof SEARCH_GROUPS)[number]

export interface AdminSearchEntry {
  id: string
  title: string
  description: string
  group: SearchGroup
  section: string
  params: Record<string, string>
  keywords: readonly string[]
  /** Visible when the staff member holds at least one; empty = any staff. */
  anyOf: readonly Permission[]
}

interface Extra {
  section: string
  title: string
  group: SearchGroup
  description: string
  keywords: readonly string[]
  params?: Record<string, string>
  anyOf?: readonly Permission[]
}

const PAGE_SYNONYMS: Record<string, readonly string[]> = {
  overview: ['dashboard', 'home', 'summary', 'kpi', 'health'],
  analytics: ['growth', 'engagement', 'retention', 'signups', 'funnel', 'dau', 'stats'],
  users: ['people', 'accounts', 'customers', 'directory', 'profiles', 'members'],
  support: ['tickets', 'helpdesk', 'help', 'inbox', 'requests', 'issues'],
  crashes: ['crash', 'errors', 'sentry', 'bugs', 'exceptions', 'testflight', 'stability'],
  sms: ['messages', 'parsing', 'bank', 'pipeline', 'templates'],
  platform: ['server', 'config', 'maintenance', 'ai', 'limits', 'services', 'version'],
  emails: ['mail', 'templates', 'transactional', 'resend', 'notifications'],
  flags: ['feature', 'toggle', 'rollout', 'kill switch', 'experiments'],
  plans: ['billing', 'subscription', 'trial', 'entitlements', 'freemium', 'membership', 'pricing'],
  'ai-cost': ['spend', 'tokens', 'gemini', 'llm', 'price', 'budget'],
  loyalty: ['points', 'tiers', 'rewards', 'perks'],
  staff: ['team', 'roles', 'permissions', 'admins', 'invite', 'access'],
  audit: ['log', 'history', 'activity', 'trail', 'security events'],
  security: ['password', 'biometric', 'sessions', 'two factor', 'sso', 'sign in'],
}

const EXTRAS: readonly Extra[] = [
  { section: 'users', group: 'Users', title: 'Suspended users', description: 'Accounts that are banned', keywords: ['banned', 'blocked'], params: { state: 'banned' } },
  { section: 'users', group: 'Users', title: 'Unverified users', description: 'Never confirmed their email', keywords: ['unconfirmed', 'pending'], params: { state: 'unconfirmed' } },
  { section: 'users', group: 'Users', title: 'Inactive users', description: 'No activity for 30 days or more', keywords: ['churn', 'dormant', 'lapsed'], params: { state: 'inactive' } },
  { section: 'users', group: 'Users', title: 'Users with SMS on', description: 'Accounts with SMS import enabled', keywords: ['sms enabled'], params: { state: 'sms' } },
  { section: 'support', group: 'Support', title: 'Create a ticket', description: 'Open a ticket for a user', keywords: ['new ticket', 'new request'], anyOf: ['support.reply'] },
  { section: 'support', group: 'Support', title: 'Ticket triage', description: 'Tickets waiting for a human', keywords: ['unassigned', 'urgent', 'queue', 'sla'] },
  { section: 'support', group: 'Support', title: 'Canned replies', description: 'Macros for ticket replies', keywords: ['macros', 'templates', 'responses'] },
  ...SMS_TABS.map((t): Extra => ({
    section: 'sms', group: 'SMS', title: t.label, description: `SMS pipeline: ${t.label}`, keywords: ['sms', t.value], params: { tab: t.value },
  })),
  { section: 'analytics', group: 'Analytics', title: 'Signups per day', description: 'New accounts over time', keywords: ['registrations', 'growth'] },
  { section: 'analytics', group: 'Analytics', title: 'Daily active users', description: 'Active users and sessions', keywords: ['dau', 'sessions', 'engagement'] },
  { section: 'analytics', group: 'Analytics', title: 'Retention', description: 'Day 1, 7, 30 and weekly cohorts', keywords: ['cohort', 'churn', 'return'] },
  { section: 'analytics', group: 'Analytics', title: 'Activation funnel', description: 'How far new users get', keywords: ['conversion', 'onboarding', 'first run'] },
  { section: 'analytics', group: 'Analytics', title: 'Feature reach', description: 'Users who have used each area', keywords: ['adoption', 'usage'] },
  { section: 'plans', group: 'Billing', title: 'Trials ending soon', description: 'Trials about to lapse', keywords: ['expiring', 'trialing'] },
  { section: 'ai-cost', group: 'Billing', title: 'AI price book', description: 'Per-token prices used for cost', keywords: ['pricing', 'models', 'tokens'] },
  { section: 'loyalty', group: 'Billing', title: 'Loyalty tier ladder', description: 'Tiers by lifetime points', keywords: ['points', 'rewards'] },
  { section: 'emails', group: 'Emails', title: 'Email send log', description: 'Every email sent and its delivery status', keywords: ['delivery', 'bounced', 'history'], params: { tab: 'log' } },
  { section: 'emails', group: 'Emails', title: 'Email setup', description: 'Auth email hook and delivery checklist', keywords: ['webhook', 'hook', 'resend', 'smtp'], params: { tab: 'setup' } },
  { section: 'staff', group: 'Team', title: 'Roles and permissions', description: 'What each role can do', keywords: ['access', 'rbac'] },
  { section: 'staff', group: 'Team', title: 'Invite a teammate', description: 'Add staff and send an invite', keywords: ['add staff', 'new admin'], anyOf: ['staff.manage'] },
  { section: 'staff', group: 'Team', title: 'Access review', description: 'Who holds which access', keywords: ['audit', 'review'] },
  { section: 'platform', group: 'Settings', title: 'Maintenance mode', description: 'Show a maintenance notice in the app', keywords: ['downtime', 'outage'] },
  { section: 'platform', group: 'Settings', title: 'In-app announcement', description: 'A banner for every user', keywords: ['banner', 'message', 'notice'] },
  { section: 'platform', group: 'Settings', title: 'Minimum app version', description: 'Force an update below a release', keywords: ['force update', 'release'] },
  { section: 'platform', group: 'Settings', title: 'AI limits', description: 'AI throttle and per-user limit', keywords: ['rate limit', 'throttle', 'gemini'] },
  { section: 'flags', group: 'Settings', title: 'Feature flags and rollouts', description: 'Roll out or switch off a feature', keywords: ['kill switch', 'percentage'] },
  { section: 'security', group: 'Settings', title: 'Sign-in protection', description: 'Admin password and single sign-on', keywords: ['sso', 'password', 'two factor'] },
  { section: 'security', group: 'Settings', title: 'Biometric unlock', description: 'Face ID or fingerprint for the portal', keywords: ['face id', 'touch id', 'fingerprint'] },
  { section: 'security', group: 'Settings', title: 'Active sessions', description: 'Where you are unlocked right now', keywords: ['devices', 'sign out', 'lock'] },
]

export function buildAdminSearchIndex(nav: readonly AdminNavGroup[] = ADMIN_NAV, extras: readonly Extra[] = EXTRAS): AdminSearchEntry[] {
  const items = nav.flatMap((g) => g.items.map((i) => ({ ...i, navGroup: g.label })))
  const pages = items.map((i): AdminSearchEntry => ({
    id: i.section,
    title: i.label,
    description: i.description,
    group: 'Pages',
    section: i.section,
    params: {},
    keywords: [...(PAGE_SYNONYMS[i.section] ?? []), i.navGroup],
    anyOf: i.anyOf,
  }))
  const subs = extras.flatMap((x): AdminSearchEntry[] => {
    const parent = items.find((i) => i.section === x.section)
    if (!parent) return []
    return [{
      id: `${x.section}:${x.title}`,
      title: x.title,
      description: x.description,
      group: x.group,
      section: x.section,
      params: x.params ?? {},
      keywords: [...x.keywords, parent.label],
      anyOf: x.anyOf ?? parent.anyOf,
    }]
  })
  return [...pages, ...subs]
}

export const ADMIN_SEARCH_INDEX: readonly AdminSearchEntry[] = buildAdminSearchIndex()

export const isEntryAllowed = (e: AdminSearchEntry, perms: PermissionSet): boolean => e.anyOf.length === 0 || canAny(perms, e.anyOf)

export interface SearchGroupResult {
  group: SearchGroup
  entries: AdminSearchEntry[]
}

/** Destinations the staff member may open, matching `query` (empty query = the pages), grouped in display order. */
export function searchAdmin(query: string, perms: PermissionSet, index: readonly AdminSearchEntry[] = ADMIN_SEARCH_INDEX): SearchGroupResult[] {
  const allowed = index.filter((e) => isEntryAllowed(e, perms))
  const hits = query.trim() ? rankEntries(allowed, query, 24) : allowed.filter((e) => e.group === 'Pages')
  return SEARCH_GROUPS.map((group) => ({ group, entries: hits.filter((e) => e.group === group) })).filter((g) => g.entries.length > 0)
}
