'use client'

import { useMemo } from 'react'
import { CreditCard, X } from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import { ExpenseDayList } from '@/components/expenses/ExpenseDayList'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useShallow } from 'zustand/react/shallow'
import { useModalTitleId } from '@/components/modals/ModalShell'
import { IconButton } from '@/components/ui/IconButton'
import { useT } from '@/lib/i18n'
import { soft } from './heroCardShared'

export interface ChargesSheetTarget {
  pmId: string
  name: string
  last4?: string
}

/** Credit-card charges — the expenses ledger filtered to this card (handoff §5). */
export function ChargesSheet({ open, onClose, target }: { open: boolean; onClose: () => void; target: ChargesSheetTarget | null }) {
  const t = useT().debts
  const { expenses } = useFinanceStore(useShallow((s) => ({ expenses: s.expenses })))

  const filtered = useMemo(() => {
    if (!target) return []
    return [...expenses]
      .filter((e) => e.paymentMethodId === target.pmId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [expenses, target])

  return (
    <ModalShell open={open} onBackdropClick={onClose} scrollChild panelClassName="h-[82dvh]">
      <div className="flex shrink-0 items-start justify-between gap-3 px-5 pt-5">
        <div className="min-w-0">
          <h2 id={useModalTitleId()} className="text-2xl font-bold text-[var(--color-brand-text-primary)]">{t.chargesTitle}</h2>
          <p className="mt-0.5 text-sm text-[var(--color-brand-text-muted)]">{t.chargesSub}</p>
        </div>
        <IconButton
          onClick={onClose}
          aria-label={t.closeLabel}
          variant="tinted"
          size="sm"
          shape="round"
          className="shrink-0"
        >
          <X className="h-4 w-4" />
        </IconButton>
      </div>

      {target ? (
        <div className="px-5 pt-3">
          <span
            className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] font-semibold text-[var(--color-cat-6)]"
            style={{ borderColor: soft('var(--color-cat-6)', 45), background: soft('var(--color-cat-6)', 12) }}
          >
            <CreditCard className="h-3.5 w-3.5" />
            {t.chargesChip(target.name)}
            {target.last4 ? <span className="font-mono-numbers">••{target.last4}</span> : null}
          </span>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain touch-pan-y pt-1">
        {filtered.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-[var(--color-brand-text-muted)]">{t.noCharges}</p>
        ) : (
          <ExpenseDayList expenses={filtered} />
        )}
      </div>
    </ModalShell>
  )
}
