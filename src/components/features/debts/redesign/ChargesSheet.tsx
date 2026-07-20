'use client'

import { useMemo } from 'react'
import { CreditCard, X } from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import { ExpenseDayList } from '@/components/expenses/ExpenseDayList'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useShallow } from 'zustand/react/shallow'

export interface ChargesSheetTarget {
  pmId: string
  name: string
  last4?: string
}

/** Credit-card charges — the expenses ledger filtered to this card (handoff §5). */
export function ChargesSheet({ open, onClose, target }: { open: boolean; onClose: () => void; target: ChargesSheetTarget | null }) {
  const { expenses } = useFinanceStore(useShallow((s) => ({ expenses: s.expenses })))

  const filtered = useMemo(() => {
    if (!target) return []
    return [...expenses]
      .filter((e) => e.paymentMethodId === target.pmId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [expenses, target])

  return (
    <ModalShell open={open} onBackdropClick={onClose} scrollChild panelClassName="h-[82vh]">
      <div className="flex shrink-0 items-start justify-between gap-3 px-5 pt-5">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold text-[var(--color-brand-text-primary)]">Expenses</h2>
          <p className="mt-0.5 text-sm text-[var(--color-brand-text-muted)]">Filtered to this card</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-muted)] hover:text-[var(--color-brand-text-primary)]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {target ? (
        <div className="px-5 pt-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#8A5CF6]/45 bg-[#8A5CF6]/12 px-3 py-1.5 text-[13px] font-semibold text-[#8A5CF6]">
            <CreditCard className="h-3.5 w-3.5" />
            Payment · {target.name}
            {target.last4 ? <span className="font-mono-numbers">•••• {target.last4}</span> : null}
          </span>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 pt-1">
        {filtered.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-[var(--color-brand-text-muted)]">No charges on this card yet.</p>
        ) : (
          <ExpenseDayList expenses={filtered} />
        )}
      </div>
    </ModalShell>
  )
}
