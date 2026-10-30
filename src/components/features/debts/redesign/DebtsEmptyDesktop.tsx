'use client'

import { CreditCard, HandCoins, Layers, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/EmptyState'
import { useT } from '@/lib/i18n'
import type { DebtFamily } from '@/lib/debts/debtFamily'

export interface DebtsEmptyDesktopProps {
  title: string
  description: string
  onAdd: (family?: DebtFamily) => void
}

/** lg+ empty Debts: one centred call to action, then the three family sections held as quiet placeholders. */
export function DebtsEmptyDesktop({ title, description, onAdd }: DebtsEmptyDesktopProps) {
  const t = useT().debts
  const families = [
    { family: 'borrow' as const, Icon: HandCoins, title: t.sectionBorrowed, line: t.emptyFamilyBorrow, add: t.newDebt },
    { family: 'credit_card' as const, Icon: CreditCard, title: t.sectionCards, line: t.emptyFamilyCard, add: t.newCard },
    { family: 'installment' as const, Icon: Layers, title: t.sectionInstallments, line: t.emptyFamilyInstallment, add: t.newInstallment },
  ]
  return (
    <div className="hidden flex-col gap-6 lg:flex">
      <EmptyState
        variant="card"
        icon={<ShieldCheck />}
        iconTone="positive"
        title={title}
        description={description}
        action={<Button size="cta" onClick={() => onAdd()}>{t.emptyAddDebt}</Button>}
      />
      <div className="grid grid-cols-3 gap-4">
        {families.map(({ family, Icon, title: name, line, add }) => (
          <Card key={family} variant="plain" padding="lg" className="flex flex-col items-center border-dashed border-[var(--color-brand-border)] text-center">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary-ink)]">
              <Icon className="size-5" strokeWidth={1.8} aria-hidden />
            </span>
            <h3 className="mt-3 text-[15px] font-bold text-[var(--color-brand-text-primary)]">{name}</h3>
            <p className="mt-1 mb-4 text-[13px] text-[var(--color-brand-text-secondary)]">{line}</p>
            <Button variant="outline" size="touch" className="mt-auto" onClick={() => onAdd(family)}>
              {add}
            </Button>
          </Card>
        ))}
      </div>
    </div>
  )
}
