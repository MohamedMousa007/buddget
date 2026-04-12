'use client'

import {
  Banknote,
  Bitcoin,
  Briefcase,
  CircleDollarSign,
  Gem,
  Home,
  Landmark,
  PiggyBank,
  Star,
  TrendingUp,
  Vault,
  Wallet,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { SAVINGS_TYPE_ICONS } from '@/lib/constants/savingsIcons'
import type { SavingsAccount } from '@/lib/store/types'
import { cn } from '@/lib/utils'

const ICON_MAP: Record<string, LucideIcon> = {
  Landmark,
  Banknote,
  Gem,
  CircleDollarSign,
  Bitcoin,
  TrendingUp,
  Home,
  Wallet,
  PiggyBank,
  Vault,
  Star,
  Briefcase,
}

export interface SavingsAccountIconProps {
  account: Pick<SavingsAccount, 'type' | 'icon' | 'emoji'>
  className?: string
}

/**
 * Renders the Lucide icon for a savings row from `icon` or the default for `type`.
 * Legacy rows may still show `emoji` when no type/icon is available.
 */
export function SavingsAccountIcon({ account, className }: SavingsAccountIconProps) {
  const key =
    typeof account.icon === 'string' && account.icon.trim()
      ? account.icon.trim()
      : SAVINGS_TYPE_ICONS[account.type]

  const Icon = ICON_MAP[key] ?? Wallet

  return <Icon className={cn('shrink-0', className)} aria-hidden />
}
