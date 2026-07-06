import type { LucideIcon } from 'lucide-react'
import {
  Home,
  Car,
  UtensilsCrossed,
  ShoppingCart,
  Fuel,
  Sparkles,
  ShoppingBag,
  HeartPulse,
  GraduationCap,
  Plug,
  RefreshCw,
  Landmark,
  Send,
  Layers,
  Banknote,
  BanknoteArrowUp,
  BadgeDollarSign,
  CreditCard,
  Coins,
  Ticket,
  Wallet,
} from 'lucide-react'

/**
 * Canonical category grid for the Add/Edit Expense sheet redesign. Order is
 * spend categories first, then money-movement (non-spend) ones. Every glyph is
 * unique (Debt→Landmark, CC Payoff→CreditCard, Currency Exchange→BadgeDollarSign,
 * Transfer→BanknoteArrowUp, Savings→Coins) and matches the design handoff.
 * `id` is the canonical {@link import('@/lib/store/types').ExpenseCategory}.
 */
export interface CategoryGridItem {
  id: string
  icon: LucideIcon
  accent: string
  nonspend?: boolean
}

export const EXPENSE_CATEGORY_GRID: CategoryGridItem[] = [
  { id: 'Rent', icon: Home, accent: '#FF6B6B' },
  { id: 'Transport', icon: Car, accent: '#4DA3FF' },
  { id: 'Food', icon: UtensilsCrossed, accent: '#F5A623' },
  { id: 'Groceries', icon: ShoppingCart, accent: '#6FD48A' },
  { id: 'Fuel', icon: Fuel, accent: '#38BDF8' },
  { id: 'Enjoyment', icon: Sparkles, accent: '#A78BFA' },
  { id: 'Shopping', icon: ShoppingBag, accent: '#F472B6' },
  { id: 'Health', icon: HeartPulse, accent: '#34D399' },
  { id: 'Education', icon: GraduationCap, accent: '#FBBF24' },
  { id: 'Utilities', icon: Plug, accent: '#FCD34D' },
  { id: 'Subscription', icon: RefreshCw, accent: '#C084FC' },
  { id: 'Debt', icon: Landmark, accent: '#FF5C5C' },
  { id: 'Remittance', icon: Send, accent: '#60A5FA' },
  { id: 'Other', icon: Layers, accent: '#9898B0' },
  { id: 'ATM Cash Withdrawal', icon: Banknote, accent: '#C7C7D6', nonspend: true },
  { id: 'Transfer', icon: BanknoteArrowUp, accent: '#93A7CE', nonspend: true },
  { id: 'Currency Exchange', icon: BadgeDollarSign, accent: '#6FD4C0', nonspend: true },
  { id: 'CC Payoff', icon: CreditCard, accent: '#F0A0A0', nonspend: true },
  { id: 'Savings', icon: Coins, accent: '#F5C842', nonspend: true },
]

/** Payment-method type → Lucide swatch glyph (matches the payment dropdown spec). */
export function paymentTypeIcon(type: string): LucideIcon {
  switch (type) {
    case 'cash':
      return Banknote
    case 'bank_transfer':
      return Landmark
    case 'card_credit':
    case 'card_debit':
      return CreditCard
    case 'nol':
      return Ticket
    default:
      return Wallet
  }
}
