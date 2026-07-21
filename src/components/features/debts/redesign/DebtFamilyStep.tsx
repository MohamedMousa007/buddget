'use client'

import { HandCoins, CreditCard, Layers, ChevronRight } from 'lucide-react'

const TILES = [
  { key: 'personal' as const, title: 'Borrow', sub: 'Money you borrowed or lent', color: '#E50914', Icon: HandCoins },
  { key: 'credit_card' as const, title: 'Credit card', sub: 'A revolving card debt', color: '#8A5CF6', Icon: CreditCard },
  { key: 'installment' as const, title: 'Installments', sub: 'A plan paid in fixed amounts', color: '#00C2A8', Icon: Layers },
]

/** Add-debt step 1: pick the family (handoff §4). */
export function DebtFamilyStep({ onPick }: { onPick: (k: 'personal' | 'credit_card' | 'installment') => void }) {
  return (
    <div className="flex flex-col gap-3 pt-1">
      {TILES.map(({ key, title, sub, color, Icon }) => (
        <button
          key={key}
          type="button"
          onClick={() => onPick(key)}
          className="flex items-center gap-3.5 rounded-[18px] border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] p-4 text-start transition-colors hover:border-[var(--color-brand-text-muted)]"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px]" style={{ background: `${color}22`, color }}>
            <Icon className="h-6 w-6" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[16px] font-bold text-[var(--color-brand-text-primary)]">{title}</span>
            <span className="block text-[13px] text-[var(--color-brand-text-muted)]">{sub}</span>
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-[var(--color-brand-text-muted)]" />
        </button>
      ))}
    </div>
  )
}
