'use client'

import type { DebtFamily } from '@/lib/debts/debtFamily'
import { OptionChip } from '@/components/ui/OptionChip'

const TABS: { key: DebtFamily; label: string }[] = [
  { key: 'borrow', label: 'Borrow' },
  { key: 'credit_card', label: 'Credit Card' },
  { key: 'installment', label: 'Installments' },
]

/** Borrow · Credit Card · Installments pill segmented control (handoff §2). */
export function DebtFamilyTabs({ active, onChange }: { active: DebtFamily; onChange: (f: DebtFamily) => void }) {
  return (
    <div className="grid grid-cols-3 gap-1 rounded-[16px] border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] p-1.5 dark:border-white/6">
      {TABS.map((tab) => {
        const on = active === tab.key
        return (
          <OptionChip
            key={tab.key}
            size="segment"
            selected={on}
            onClick={() => onChange(tab.key)}
            className="font-bold"
          >
            {tab.label}
          </OptionChip>
        )
      })}
    </div>
  )
}
