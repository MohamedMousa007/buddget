'use client'

import { ChevronRight, CreditCard, HandCoins, Layers, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/EmptyState'
import { useT } from '@/lib/i18n'
import type { DebtFamily } from '@/lib/debts/debtFamily'

export interface DebtsEmptyFamiliesProps {
  title: string
  description: string
  onAdd: (family?: DebtFamily) => void
}

/** Mobile empty Debts: the empty state, with the three things you can track as rows that start the right form. */
export function DebtsEmptyFamilies({ title, description, onAdd }: DebtsEmptyFamiliesProps) {
  const t = useT().debts
  const rows = [
    { family: 'borrow' as const, Icon: HandCoins, title: t.sectionBorrowed, line: t.emptyFamilyBorrow },
    { family: 'credit_card' as const, Icon: CreditCard, title: t.sectionCards, line: t.emptyFamilyCard },
    { family: 'installment' as const, Icon: Layers, title: t.sectionInstallments, line: t.emptyFamilyInstallment },
  ]
  return (
    <EmptyState
      variant="card"
      className="mt-2 lg:hidden"
      icon={<ShieldCheck />}
      iconTone="positive"
      title={title}
      description={description}
      action={<Button size="cta" onClick={() => onAdd()}>{t.emptyAddDebt}</Button>}
    >
      <Card padding="none" variant="plain" className="divide-y divide-[var(--color-brand-border)] overflow-hidden rounded-2xl">
        {rows.map(({ family, Icon, title: name, line }) => (
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
              <span className="block text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">{name}</span>
              <span className="block text-[0.8125rem] leading-snug text-[var(--color-brand-text-secondary)]">{line}</span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-[var(--color-brand-text-muted)] rtl:rotate-180" aria-hidden />
          </button>
        ))}
      </Card>
    </EmptyState>
  )
}
