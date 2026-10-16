'use client'

import type { DebtFamily } from '@/lib/debts/debtFamily'
import { OptionChip } from '@/components/ui/OptionChip'
import { useT } from '@/lib/i18n'

/** Borrow · Credit Card · Installments segmented control; each label carries its active count. */
export function DebtFamilyTabs({
  active,
  onChange,
  counts,
}: {
  active: DebtFamily
  onChange: (f: DebtFamily) => void
  counts: Record<DebtFamily, number>
}) {
  const t = useT().debts
  const tabs: { key: DebtFamily; label: string }[] = [
    { key: 'borrow', label: t.tabBorrow },
    { key: 'credit_card', label: t.tabCards },
    { key: 'installment', label: t.tabInstallments },
  ]
  return (
    <div className="grid grid-cols-3 gap-1 rounded-[16px] border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] p-1.5">
      {tabs.map((tab) => (
        <OptionChip
          key={tab.key}
          size="segment"
          selected={active === tab.key}
          onClick={() => onChange(tab.key)}
          className="font-bold"
        >
          {tab.label}
          {counts[tab.key] > 0 ? <span className="font-mono-numbers opacity-70">{counts[tab.key]}</span> : null}
        </OptionChip>
      ))}
    </div>
  )
}
