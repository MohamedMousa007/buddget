'use client'

import { HandCoins, CreditCard, Layers, ChevronRight } from 'lucide-react'
import { SelectableCard } from '@/components/ui/SelectableCard'
import { useT } from '@/lib/i18n'
import { soft } from './heroCardShared'

/** Add-debt step 1: pick the family (handoff §4). */
export function DebtFamilyStep({ onPick }: { onPick: (k: 'personal' | 'credit_card' | 'installment') => void }) {
  const t = useT().debts
  const TILES = [
    { key: 'personal' as const, title: t.tabBorrow, sub: t.famBorrowSub, color: 'var(--color-brand-red)', Icon: HandCoins },
    { key: 'credit_card' as const, title: t.famCardTitle, sub: t.famCardSub, color: 'var(--color-cat-6)', Icon: CreditCard },
    { key: 'installment' as const, title: t.tabInstallments, sub: t.famInstallmentSub, color: 'var(--color-cat-5)', Icon: Layers },
  ]
  return (
    <div className="flex flex-col gap-3 pt-1">
      {TILES.map(({ key, title, sub, color, Icon }) => (
        <SelectableCard
          key={key}
          as="action"
          onClick={() => onPick(key)}
          className="gap-3.5 p-4"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px]" style={{ background: soft(color, 16), color }}>
            <Icon className="h-6 w-6" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[16px] font-bold text-[var(--color-brand-text-primary)]">{title}</span>
            <span className="block text-[0.8125rem] text-[var(--color-brand-text-muted)]">{sub}</span>
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 rtl:rotate-180 text-[var(--color-brand-text-muted)]" />
        </SelectableCard>
      ))}
    </div>
  )
}
