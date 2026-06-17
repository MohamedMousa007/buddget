'use client'

import { Briefcase, Gem, Laptop, TrendingUp, Landmark, CreditCard, Gift, RotateCcw, Wallet } from 'lucide-react'
import type { IncomeSourceType } from '@/lib/store/types'
import { cn } from '@/lib/utils'

/** Static lucide glyph per income source type (branch-per-type to satisfy the static-components lint rule). */
export function IncomeTypeIcon({ type, className }: { type: IncomeSourceType | undefined; className?: string }) {
  const c = cn('shrink-0', className)
  switch (type ?? 'other') {
    case 'salary':
      return <Briefcase className={c} />
    case 'bonus':
      return <Gem className={c} />
    case 'side_hustle':
      return <Laptop className={c} />
    case 'investment':
      return <TrendingUp className={c} />
    case 'savings':
      return <Landmark className={c} />
    case 'debt':
      return <CreditCard className={c} />
    case 'gift':
      return <Gift className={c} />
    case 'refund':
      return <RotateCcw className={c} />
    default:
      return <Wallet className={c} />
  }
}

export function incomeTypeColors(type: IncomeSourceType | undefined): { fg: string; bg: string } {
  switch (type ?? 'other') {
    case 'salary':
    case 'investment':
      return { fg: 'var(--color-brand-green)', bg: 'rgba(29,185,84,.13)' }
    case 'side_hustle':
      return { fg: '#4DA3FF', bg: 'rgba(77,163,255,.13)' }
    case 'bonus':
    case 'savings':
      return { fg: 'var(--color-brand-gold)', bg: 'rgba(245,200,66,.13)' }
    case 'debt':
      return { fg: '#FF5C5C', bg: 'rgba(255,92,92,.13)' }
    case 'gift':
      return { fg: '#A78BFA', bg: 'rgba(167,139,250,.13)' }
    default:
      return { fg: 'var(--color-brand-amber)', bg: 'rgba(255,159,10,.13)' }
  }
}
