import type { Permission } from './permissions'

export interface AdminNavItem {
  section: string
  label: string
  /** lucide icon name, resolved in the shell */
  icon: string
  /** Visible when the staff member holds at least one of these. Empty = any staff. */
  anyOf: readonly Permission[]
  description: string
}

export interface AdminNavGroup {
  label: string
  items: readonly AdminNavItem[]
}

export const ADMIN_NAV: readonly AdminNavGroup[] = [
  {
    label: 'Insights',
    items: [
      { section: 'overview', label: 'Overview', icon: 'LayoutDashboard', anyOf: ['overview.view'], description: 'Executive snapshot of the whole business' },
      { section: 'analytics', label: 'Growth & engagement', icon: 'TrendingUp', anyOf: ['analytics.view'], description: 'Signups, activity, retention and adoption' },
    ],
  },
  {
    label: 'People',
    items: [
      { section: 'users', label: 'Users', icon: 'Users', anyOf: ['users.view'], description: 'Directory, profiles and account controls' },
      { section: 'leads', label: 'Website leads', icon: 'Inbox', anyOf: ['leads.view'], description: 'Contact messages and waitlist sign-ups from the website' },
      { section: 'support', label: 'Support desk', icon: 'LifeBuoy', anyOf: ['support.view'], description: 'Tickets and help for users' },
    ],
  },
  {
    label: 'Product health',
    items: [
      { section: 'sms', label: 'SMS pipeline', icon: 'MessageSquareText', anyOf: ['sms.view'], description: 'Tracked SMS, error queue, templates' },
      { section: 'crashes', label: 'Crashes', icon: 'Bug', anyOf: ['crashes.view'], description: 'App crashes and errors by release' },
      { section: 'platform', label: 'Platform', icon: 'Server', anyOf: ['platform.view'], description: 'AI limits, maintenance and server state' },
      { section: 'emails', label: 'Emails', icon: 'Mail', anyOf: ['emails.view'], description: 'Transactional email templates and send log' },
      { section: 'flags', label: 'Feature flags', icon: 'ToggleRight', anyOf: ['flags.view'], description: 'Rollouts and kill-switches' },
    ],
  },
  {
    label: 'Monetization',
    items: [
      { section: 'plans', label: 'Plans & memberships', icon: 'CreditCard', anyOf: ['billing.view'], description: 'Freemium plans, trials and entitlements' },
      { section: 'ai-cost', label: 'AI cost', icon: 'Coins', anyOf: ['ai.cost.view'], description: 'What AI usage costs, by day, model and feature' },
      { section: 'loyalty', label: 'Loyalty', icon: 'Award', anyOf: ['loyalty.view'], description: 'Tiers, points and perks' },
    ],
  },
  {
    label: 'Governance',
    items: [
      { section: 'staff', label: 'Team & roles', icon: 'ShieldCheck', anyOf: ['staff.view'], description: 'Staff, roles and permissions' },
      { section: 'audit', label: 'Audit log', icon: 'ScrollText', anyOf: ['audit.view'], description: 'Every privileged action, append-only' },
      { section: 'security', label: 'My security', icon: 'KeyRound', anyOf: [], description: 'Password, 2FA, biometrics and sessions' },
    ],
  },
]
