'use client'

import { useShallow } from 'zustand/react/shallow'
import { ModalShell } from '@/components/modals/ModalShell'
import { ModalSheetHeader } from '@/components/modals/ModalSheetHeader'
import { useFinanceStore } from '@/lib/store/useFinanceStore'

/** Read-only view of a scanned receipt's itemized breakdown (items + charges). */
export function ReceiptDetailSheet({
  receiptId,
  open,
  onClose,
}: {
  receiptId: string | null
  open: boolean
  onClose: () => void
}) {
  const { receipt, paymentMethods } = useFinanceStore(
    useShallow((s) => ({
      receipt: receiptId ? s.receipts.find((r) => r.id === receiptId) ?? null : null,
      paymentMethods: s.paymentMethods,
    })),
  )

  const shellOpen = open && !!receipt

  return (
    <ModalShell open={shellOpen} onBackdropClick={onClose}>
      {receipt ? (
        <div className="p-5">
          <ModalSheetHeader title="Receipt" onClose={onClose} />

          <div className="space-y-1">
            <p className="text-base font-semibold text-[var(--color-brand-text-primary)]">{receipt.merchant || 'Receipt'}</p>
            <p className="text-xs text-[var(--color-brand-text-muted)]">
              {receipt.receiptDate} · {receipt.category}
              {(() => {
                const pm = paymentMethods.find((m) => m.id === receipt.paymentMethodId)
                return pm ? ` · ${pm.name}` : ''
              })()}
            </p>
          </div>

          {receipt.items.length > 0 ? (
            <ul className="mt-4 space-y-1.5">
              {receipt.items.map((it, i) => (
                <li key={`item-${i}`} className="flex items-baseline gap-2 text-sm">
                  <span className="flex-1 truncate text-[var(--color-brand-text-primary)]">
                    {it.qty && it.qty > 1 ? `${it.qty}× ` : ''}{it.name}
                  </span>
                  <span className="tabular-nums text-[var(--color-brand-text-secondary)]">
                    {it.price.toFixed(2)} {receipt.currency}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          {receipt.charges.length > 0 ? (
            <ul className="mt-3 space-y-1.5 border-t border-[var(--color-brand-border)] pt-3">
              {receipt.charges.map((c, i) => (
                <li key={`charge-${i}`} className="flex items-baseline gap-2 text-sm">
                  <span className="flex-1 truncate text-[var(--color-brand-text-muted)]">{c.label}</span>
                  <span className="tabular-nums text-[var(--color-brand-text-secondary)]">
                    {c.amount.toFixed(2)} {receipt.currency}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-3 flex items-baseline justify-between border-t border-[var(--color-brand-border)] pt-3">
            <span className="text-sm font-semibold text-[var(--color-brand-text-primary)]">Total</span>
            <span className="tabular-nums text-base font-semibold text-[var(--color-brand-text-primary)]">
              {receipt.amount.toFixed(2)} {receipt.currency}
            </span>
          </div>

          {receipt.notes ? (
            <p className="mt-3 text-xs text-[var(--color-brand-text-muted)]">{receipt.notes}</p>
          ) : null}
        </div>
      ) : null}
    </ModalShell>
  )
}
