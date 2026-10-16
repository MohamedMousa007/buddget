import type { ComponentType } from 'react'
import type { LucideIcon, LucideProps } from 'lucide-react'
import { Landmark, Plus, SlidersHorizontal, Coins } from 'lucide-react'
import type { Dictionary } from '@/lib/i18n'
import { FlowTabIcon } from '@/components/icons/FlowTabIcon'

export type BuddgetNavIcon = LucideIcon

export type BottomNavItem =
  | { kind: 'link'; href: string; label: string; icon: LucideIcon | ComponentType<LucideProps> }
  | { kind: 'fab'; icon: typeof Plus }

export const BOTTOM_NAV_ITEMS: BottomNavItem[] = [
  { kind: 'link', href: '/flow', label: 'flow', icon: FlowTabIcon },
  { kind: 'link', href: '/budget-setup', label: 'budgetSetup', icon: SlidersHorizontal },
  { kind: 'fab', icon: Plus },
  { kind: 'link', href: '/wealth', label: 'wealth', icon: Coins },
  { kind: 'link', href: '/debts', label: 'debts', icon: Landmark },
]

/** Routes that light each tab: the tab's own page plus its aliases and the pages it owns. */
export const BOTTOM_NAV_TAB_PATHS: Record<string, ReadonlySet<string>> = {
  '/flow': new Set(['/', '/flow', '/expenses', '/income', '/paydays']),
  '/budget-setup': new Set(['/budget-setup', '/subscriptions']),
  '/wealth': new Set(['/wealth', '/savings', '/investment']),
  '/debts': new Set(['/debts']),
}

/** Maps a route to its header section-title dictionary key (`t.nav[key]`). */
export function sectionTitleNavKey(pathname: string | null): keyof Dictionary['nav'] | null {
  if (!pathname) return null
  if (pathname === '/') return 'flow'
  if (pathname.startsWith('/flow')) return 'flow'
  if (pathname.startsWith('/paydays')) return 'paydays'
  if (pathname.startsWith('/expenses')) return 'flow'
  if (pathname.startsWith('/debts')) return 'debts'
  if (pathname.startsWith('/income')) return 'flow'
  if (pathname.startsWith('/wealth')) return 'wealth'
  // aliases of /wealth
  if (pathname.startsWith('/savings')) return 'wealth'
  if (pathname.startsWith('/investment')) return 'wealth'
  if (pathname.startsWith('/subscriptions')) return 'subscriptions'
  if (pathname.startsWith('/budget-setup')) return 'budgetSetup'
  if (pathname.startsWith('/settings')) return 'settings'
  if (pathname.startsWith('/reports')) return 'reports'
  if (pathname.startsWith('/goals')) return 'goals'
  return null
}
