'use client'

import { Banknote, Gem, Landmark } from 'lucide-react'
import { OptionSheet } from '@/components/ui/OptionSheet'
import { useSavingsV9Copy } from '@/lib/i18n/savingsV9Copy'

/** Outside money is never a bare amount: it is an account not added yet, Cash, or something held outside the accounts. */
export type MoneyWhere = 'new' | 'cash' | 'gold'

/** "Where is this money?" (final-ui v9), opened from Add money's Outside tab. */
export function WhereMoneySheet({ open, value, onPick, onClose }: { open: boolean; value: MoneyWhere | null; onPick: (w: MoneyWhere) => void; onClose: () => void }) {
  const c = useSavingsV9Copy().where
  return (
    <OptionSheet<MoneyWhere>
      open={open}
      onClose={onClose}
      overSheet
      zIndexClassName="z-[120]"
      title={c.title}
      subtitle={c.sub}
      value={value}
      onChange={onPick}
      options={[
        { value: 'new', title: c.newAccount, subtitle: c.newAccountSub, icon: <Landmark />, tone: 'var(--color-brand-primary)' },
        { value: 'cash', title: c.cash, subtitle: c.cashSub, icon: <Banknote />, tone: 'var(--color-brand-amber)' },
        { value: 'gold', title: c.gold, subtitle: c.goldSub, icon: <Gem />, tone: 'var(--color-brand-gold)' },
      ]}
    />
  )
}
