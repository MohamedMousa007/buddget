'use client'

import type { DebtFamily } from '@/lib/debts/debtFamily'

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
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={`h-11 rounded-[12px] text-sm font-bold transition-colors ${
              on
                ? 'bg-[var(--color-brand-red)] text-white'
                : 'text-[var(--color-brand-text-secondary)] hover:text-[var(--color-brand-text-primary)]'
            }`}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
