import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard,
  Receipt,
  Landmark,
  Plus,
  Menu,
  Wallet,
  PiggyBank,
  BarChart3,
} from 'lucide-react'

export type BottomNavItem =
  | { kind: 'link'; href: string; label: string; icon: LucideIcon }
  | { kind: 'fab'; icon: typeof Plus }
  | { kind: 'more'; label: string; icon: typeof Menu }

export const BOTTOM_NAV_ITEMS: BottomNavItem[] = [
  { kind: 'link', href: '/', label: 'Home', icon: LayoutDashboard },
  { kind: 'link', href: '/expenses', label: 'Expenses', icon: Receipt },
  { kind: 'fab', icon: Plus },
  { kind: 'link', href: '/debts', label: 'Debts', icon: Landmark },
  { kind: 'more', label: 'More', icon: Menu },
]

/** Extra routes in the “More” sheet — keep in sync when adding top-level pages. */
export const BOTTOM_NAV_MORE_MENU: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/income', label: 'Income', icon: Wallet },
  { href: '/savings', label: 'Savings', icon: PiggyBank },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
]

export const BOTTOM_NAV_MORE_HREFS = new Set(BOTTOM_NAV_MORE_MENU.map((m) => m.href))
