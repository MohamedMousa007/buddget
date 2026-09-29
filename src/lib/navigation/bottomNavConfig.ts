import type { ComponentType } from 'react'
import type { LucideIcon, LucideProps } from 'lucide-react'
import {
  House,
  Landmark,
  Plus,
  Menu,
  BarChart3,
  SlidersHorizontal,
  Coins,
  RefreshCw,
} from 'lucide-react'
import type { Dictionary } from '@/lib/i18n'
import { FlowTabIcon } from '@/components/icons/FlowTabIcon'

export type BuddgetNavIcon = LucideIcon

export type BottomNavItem =
  | { kind: 'link'; href: string; label: string; icon: LucideIcon | ComponentType<LucideProps> }
  | { kind: 'fab'; icon: typeof Plus }
  | { kind: 'more'; label: string; icon: typeof Menu }

export const BOTTOM_NAV_ITEMS: BottomNavItem[] = [
  { kind: 'link', href: '/', label: 'home', icon: House },
  { kind: 'link', href: '/flow', label: 'flow', icon: FlowTabIcon },
  { kind: 'fab', icon: Plus },
  { kind: 'link', href: '/debts', label: 'debts', icon: Landmark },
  { kind: 'more', label: 'more', icon: Menu },
]

/** A row in the "More" bottom-sheet — carries the tinted icon chip colors from the redesign. */
export interface MoreMenuItem {
  href: string
  label: string
  icon: BuddgetNavIcon
  /** icon foreground (solid accent) */
  fg: string
  /** icon chip background (translucent tint) */
  bg: string
}

/**
 * Extra routes in the "More" sheet — keep in sync when adding top-level pages.
 * Settings intentionally lives in the Profile menu, not here.
 */
export const BOTTOM_NAV_MORE_MENU: MoreMenuItem[] = [
  { href: '/budget-setup', label: 'budgetSetup', icon: SlidersHorizontal, fg: 'var(--color-brand-primary)', bg: 'rgba(18,176,160,.13)' },
  // Savings and Investment merged into one destination (design/IA_MASTER_PLAN.md).
  { href: '/wealth', label: 'wealth', icon: Coins, fg: 'var(--color-brand-gold)', bg: 'rgba(237,196,99,.13)' },
  { href: '/subscriptions', label: 'subscriptions', icon: RefreshCw, fg: '#4DA3FF', bg: 'rgba(77,163,255,.13)' },
  { href: '/reports', label: 'reports', icon: BarChart3, fg: '#A78BFA', bg: 'rgba(167,139,250,.13)' },
]

/** Routes where the bottom-nav "More" tab renders active (includes Settings, which moved to Profile). */
export const BOTTOM_NAV_MORE_HREFS = new Set<string>([
  '/budget-setup',
  '/wealth',
  '/savings',
  '/investment',
  '/subscriptions',
  '/reports',
  '/settings',
])

/** Maps a route to its header section-title dictionary key (`t.nav[key]`). */
export function sectionTitleNavKey(pathname: string | null): keyof Dictionary['nav'] | null {
  if (!pathname) return null
  if (pathname === '/') return 'home'
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
  if (pathname.startsWith('/goals')) return 'wealth'
  return null
}
