'use client'

import {
  Home,
  UtensilsCrossed,
  Car,
  Sparkles,
  ShoppingBag,
  ShoppingCart,
  Heart,
  HeartPulse,
  GraduationCap,
  Smartphone,
  RefreshCw,
  Coins,
  CreditCard,
  Send,
  Zap,
  Layers,
  Wallet,
  Fuel,
  Plug,
  Banknote,
  ArrowLeftRight,
  WalletCards,
  CalendarClock,
  Landmark,
  BadgeDollarSign,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { categoryChipColors } from '@/lib/expenses/categoryChip'

export interface CategoryIconProps {
  category: string
  className?: string
}

/**
 * Static lucide glyph for a category. Implemented as a component (rather
 * than a helper returning a component reference) so the
 * `react-hooks/static-components` lint rule stays happy — every branch here
 * renders a known lucide component directly, no dynamic component variable
 * created during render.
 *
 * Every known category maps to a specific icon. Anything unrecognised gets
 * `Wallet` — a neutral finance glyph — rather than a generic dots menu.
 */
export function CategoryIcon({ category, className }: CategoryIconProps) {
  const key = (category || '').trim().toLowerCase().replace(/[\s-]+/g, '_')
  const c = cn('shrink-0', className)

  if (key === 'rent' || key === 'housing' || key === 'home') return <Home className={c} />
  if (key === 'groceries') return <ShoppingCart className={c} />
  if (key === 'dining' || key === 'dining_out' || key === 'restaurants') return <UtensilsCrossed className={c} />
  if (key === 'food') return <UtensilsCrossed className={c} />
  if (key === 'transport' || key === 'transportation' || key === 'commute') return <Car className={c} />
  if (key === 'fuel' || key === 'petrol' || key === 'gas') return <Fuel className={c} />
  if (key === 'utilities' || key === 'utility' || key === 'bills') return <Plug className={c} />
  if (key === 'entertainment' || key === 'enjoy' || key === 'enjoyment') return <Sparkles className={c} />
  if (key === 'personal' || key === 'personal_care' || key === 'self_care') return <Heart className={c} />
  if (key === 'phone' || key === 'internet' || key === 'phone_internet') return <Smartphone className={c} />
  if (key === 'subscription' || key === 'subscriptions') return <RefreshCw className={c} />
  if (key === 'shopping' || key === 'shop') return <ShoppingBag className={c} />
  if (key === 'health' || key === 'healthcare' || key === 'medical') return <HeartPulse className={c} />
  if (key === 'education' || key === 'school') return <GraduationCap className={c} />
  if (key === 'savings' || key === 'saving' || key === 'investment') return <Coins className={c} />
  if (key === 'debt' || key === 'loan' || key === 'credit') return <Landmark className={c} />
  if (key === 'cc_payoff') return <CreditCard className={c} />
  if (key === 'atm_cash_withdrawal' || key === 'atm') return <Banknote className={c} />
  if (key === 'currency_exchange') return <BadgeDollarSign className={c} />
  if (key === 'instapay') return <Zap className={c} />
  if (key === 'remittance') return <Send className={c} />
  if (key === 'transfer') return <ArrowLeftRight className={c} />
  if (key === 'top_up') return <WalletCards className={c} />
  if (key === 'installment') return <CalendarClock className={c} />
  if (key === 'other') return <Layers className={c} />
  return <Wallet className={c} />
}

/** {@link CategoryIcon} tinted with the category's chip colour (same accent as the ledger rows). */
export function CategoryGlyph({ category, className }: CategoryIconProps) {
  return (
    <span aria-hidden className="inline-flex shrink-0" style={{ color: categoryChipColors(category).fg }}>
      <CategoryIcon category={category} className={className} />
    </span>
  )
}
