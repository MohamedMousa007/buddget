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
  WalletCards,
  CalendarClock,
  Split,
  Shapes,
  Briefcase,
  Award,
  Laptop,
  TrendingUp,
  PiggyBank,
  HandCoins,
  Gift,
  Undo2,
} from 'lucide-react'
import type { IncomeSourceType } from '@/lib/store/types'

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
  { id: 'Top up', icon: WalletCards, accent: '#2DD4BF', nonspend: true },
  { id: 'Installment', icon: CalendarClock, accent: '#EC4899', nonspend: true },
  { id: 'Savings', icon: Coins, accent: '#F5C842', nonspend: true },
]

/** Income source type → unique Lucide glyph + accent. Single source of truth for
 * {@link import('@/components/features/income/IncomeTypeIcon').IncomeTypeIcon} and the
 * income type picker. Every glyph and accent is distinct (no shared green/gold). */
export interface IncomeTypeGridItem {
  id: IncomeSourceType
  icon: LucideIcon
  accent: string
}

// Accents match the Income handoff §9 "Type colors" spec exactly.
export const INCOME_TYPE_GRID: IncomeTypeGridItem[] = [
  { id: 'salary', icon: Briefcase, accent: '#1DB954' },
  { id: 'bonus', icon: Award, accent: '#F5C842' },
  { id: 'side_hustle', icon: Laptop, accent: '#4DA3FF' },
  { id: 'investment', icon: TrendingUp, accent: '#A78BFA' },
  { id: 'savings', icon: PiggyBank, accent: '#F5C842' },
  { id: 'debt', icon: HandCoins, accent: '#FF6B6B' },
  { id: 'gift', icon: Gift, accent: '#F472B6' },
  { id: 'refund', icon: Undo2, accent: '#38BDF8' },
  { id: 'other', icon: Wallet, accent: '#9898B0' },
]

const INCOME_TYPE_BY_ID: Record<IncomeSourceType, IncomeTypeGridItem> = Object.fromEntries(
  INCOME_TYPE_GRID.map((it) => [it.id, it]),
) as Record<IncomeSourceType, IncomeTypeGridItem>

/** Grid item for an income source type, falling back to `other`. */
export function incomeTypeGridItem(type: IncomeSourceType | undefined): IncomeTypeGridItem {
  return INCOME_TYPE_BY_ID[type ?? 'other'] ?? INCOME_TYPE_BY_ID.other
}

/** Payment-method type → Lucide swatch glyph (matches the payment dropdown spec). */
export function paymentTypeIcon(type: string): LucideIcon {
  switch (type) {
    case 'cash':
      return Banknote
    case 'bank_account':
      return Landmark
    case 'credit_card':
    case 'debit_card':
      return CreditCard
    case 'prepaid_card':
      return Ticket
    case 'wallet':
      return Wallet
    case 'bnpl':
      return Split
    case 'other':
      return Shapes
    default:
      return Wallet
  }
}
