import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard,
  Receipt,
  Landmark,
  Plus,
  Menu,
  Wallet,
  BarChart3,
  SlidersHorizontal,
  Coins,
  RefreshCw,
} from 'lucide-react'
import type { Dictionary } from '@/lib/i18n'

export type BuddgetNavIcon = LucideIcon

export type BottomNavItem =
  | { kind: 'link'; href: string; label: string; icon: LucideIcon }
  | { kind: 'fab'; icon: typeof Plus }
  | { kind: 'more'; label: string; icon: typeof Menu }

export const BOTTOM_NAV_ITEMS: BottomNavItem[] = [
  { kind: 'link', href: '/', label: 'home', icon: LayoutDashboard },
  { kind: 'link', href: '/expenses', label: 'expenses', icon: Receipt },
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
  { href: '/budget-setup', label: 'budgetSetup', icon: SlidersHorizontal, fg: 'var(--color-brand-red)', bg: 'rgba(229,9,20,.13)' },
  { href: '/income', label: 'income', icon: Wallet, fg: 'var(--color-brand-green)', bg: 'rgba(29,185,84,.13)' },
  { href: '/savings', label: 'savings', icon: Coins, fg: 'var(--color-brand-gold)', bg: 'rgba(245,200,66,.13)' },
  { href: '/subscriptions', label: 'subscriptions', icon: RefreshCw, fg: '#4DA3FF', bg: 'rgba(77,163,255,.13)' },
  { href: '/reports', label: 'reports', icon: BarChart3, fg: '#A78BFA', bg: 'rgba(167,139,250,.13)' },
]

/** Routes where the bottom-nav "More" tab renders active (includes Settings, which moved to Profile). */
export const BOTTOM_NAV_MORE_HREFS = new Set<string>([
  '/budget-setup',
  '/income',
  '/savings',
  '/subscriptions',
  '/reports',
  '/settings',
])

/** Maps a route to its header section-title dictionary key (`t.nav[key]`). */
export function sectionTitleNavKey(pathname: string | null): keyof Dictionary['nav'] | null {
  if (!pathname) return null
  if (pathname === '/') return 'home'
  if (pathname.startsWith('/expenses')) return 'expenses'
  if (pathname.startsWith('/debts')) return 'debts'
  if (pathname.startsWith('/income')) return 'income'
  if (pathname.startsWith('/savings')) return 'savings'
  if (pathname.startsWith('/subscriptions')) return 'subscriptions'
  if (pathname.startsWith('/budget-setup')) return 'budgetSetup'
  if (pathname.startsWith('/settings')) return 'settings'
  if (pathname.startsWith('/reports')) return 'reports'
  if (pathname.startsWith('/goals')) return 'savings'
  return null
}
