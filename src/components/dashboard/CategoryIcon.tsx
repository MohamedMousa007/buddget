'use client'

import {
  Home,
  UtensilsCrossed,
  Car,
  Sparkles,
  ShoppingBag,
  Heart,
  GraduationCap,
  MoreHorizontal,
  PiggyBank,
  CreditCard,
  Send,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface CategoryIconProps {
  category: string
  className?: string
}

/**
 * Static lucide glyph for a category. Implemented as a component (rather
 * than a helper that returns a component reference) so the
 * `react-hooks/static-components` lint rule stays happy — every branch here
 * renders a known lucide component directly, no dynamic component variable
 * created during render.
 */
export function CategoryIcon({ category, className }: CategoryIconProps) {
  const key = (category || '').trim().toLowerCase()
  const c = cn('shrink-0', className)
  if (key === 'rent' || key === 'housing' || key === 'home') return <Home className={c} />
  if (key === 'food' || key === 'groceries' || key === 'dining') return <UtensilsCrossed className={c} />
  if (key === 'transport' || key === 'transportation' || key === 'commute') return <Car className={c} />
  if (
    key === 'enjoy' ||
    key === 'enjoyment' ||
    key === 'entertainment' ||
    key === 'subscription' ||
    key === 'subscriptions'
  )
    return <Sparkles className={c} />
  if (key === 'shopping' || key === 'shop') return <ShoppingBag className={c} />
  if (key === 'health' || key === 'healthcare' || key === 'medical') return <Heart className={c} />
  if (key === 'education' || key === 'school') return <GraduationCap className={c} />
  if (key === 'savings' || key === 'saving' || key === 'investment') return <PiggyBank className={c} />
  if (key === 'debt' || key === 'loan' || key === 'credit') return <CreditCard className={c} />
  if (key === 'remittance' || key === 'transfer') return <Send className={c} />
  return <MoreHorizontal className={c} />
}
