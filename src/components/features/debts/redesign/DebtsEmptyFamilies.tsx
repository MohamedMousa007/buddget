'use client'

import { ChevronRight, CreditCard, HandCoins, Layers } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { useT } from '@/lib/i18n'
import type { DebtFamily } from '@/lib/debts/debtFamily'

export interface DebtsEmptyFamiliesProps {
  onAdd: (family: DebtFamily) => void
}

/** Mobile empty Debts: the three things you can track, as rows that start the right form. */
export function DebtsEmptyFamilies({ onAdd }: DebtsEmptyFamiliesProps) {
  const t = useT().debts
  const rows = [
    { family: 'borrow' as const, Icon: HandCoins, title: t.sectionBorrowed, line: t.emptyFamilyBorrow },
    { family: 'credit_card' as const, Icon: CreditCard, title: t.sectionCards, line: t.emptyFamilyCard },
    { family: 'installment' as const, Icon: Layers, title: t.sectionInstallments, line: t.emptyFamilyInstallment },
  ]
  return (
    <Card padding="none" className="mt-6 divide-y divide-[var(--color-brand-border)] overflow-hidden rounded-2xl lg:hidden">
      {rows.map(({ family, Icon, title, line }) => (
        <button
          key={family}
          type="button"
          data-raw-button-ok="a whole-row tap target, sized by its content"
          onClick={() => onAdd(family)}
          className="flex min-h-16 w-full items-center gap-3.5 px-4 py-3 text-start"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary-ink)]">
            <Icon className="size-5" strokeWidth={1.8} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold text-[var(--color-brand-text-primary)]">{title}</span>
            <span className="block text-[13px] leading-snug text-[var(--color-brand-text-secondary)]">{line}</span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-[var(--color-brand-text-muted)] rtl:rotate-180" aria-hidden />
        </button>
      ))}
    </Card>
  )
}
