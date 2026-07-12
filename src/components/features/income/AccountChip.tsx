'use client'

import { createElement } from 'react'
import { PiggyBank, Landmark, Wallet } from 'lucide-react'
import { paymentTypeIcon } from '@/lib/constants/categoryGrid'
import type { PaymentMethod } from '@/lib/store/types'

interface Props {
  label: string
  acct: { linkedSavingsAccountId?: string; linkedDebtId?: string; paymentMethodId?: string }
  paymentMethods: PaymentMethod[]
}

/**
 * Compact account line for income surfaces: a 16px chip with the payment-method
 * type glyph (savings/debt links get their own glyphs) + the account name.
 */
export function AccountChip({ label, acct, paymentMethods }: Props) {
  const pm = acct.paymentMethodId ? paymentMethods.find((m) => m.id === acct.paymentMethodId) : undefined
  const icon = acct.linkedSavingsAccountId ? PiggyBank : acct.linkedDebtId ? Landmark : pm ? paymentTypeIcon(pm.type) : Wallet
  return (
    <>
      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] bg-white/12 text-white/80">
        {createElement(icon, { className: 'h-[10px] w-[10px]' })}
      </span>
      <span className="truncate">{label}</span>
    </>
  )
}
