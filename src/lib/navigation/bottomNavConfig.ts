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
} from 'lucide-react'
import { SavingsIcon } from '@/components/icons/SavingsIcon'

/** Lucide icons or stroke-matched custom SVGs (e.g. savings). */
export type BuddgetNavIcon = LucideIcon | typeof SavingsIcon

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

/** Extra routes in the "More" sheet — keep in sync when adding top-level pages. */
export const BOTTOM_NAV_MORE_MENU: { href: string; label: string; icon: BuddgetNavIcon }[] = [
  { href: '/budget-setup', label: 'budgetSetup', icon: SlidersHorizontal },
  { href: '/income', label: 'income', icon: Wallet },
  { href: '/savings', label: 'savings', icon: SavingsIcon },
  { href: '/reports', label: 'reports', icon: BarChart3 },
]

export const BOTTOM_NAV_MORE_HREFS = new Set(BOTTOM_NAV_MORE_MENU.map((m) => m.href))
