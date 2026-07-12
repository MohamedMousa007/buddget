'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useShallow } from 'zustand/react/shallow'
import { ModalShell } from '@/components/modals/ModalShell'
import { ModalSheetHeader } from '@/components/modals/ModalSheetHeader'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { readReceiptImage } from '@/lib/native/receiptImages'

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

  const [img, setImg] = useState<{ id: string; src: string } | null>(null)
  useEffect(() => {
    if (!open || !receiptId) return
    let stale = false
    void readReceiptImage(receiptId).then((src) => {
      if (!stale && src) setImg({ id: receiptId, src })
    })
    return () => { stale = true }
  }, [open, receiptId])
  const imgSrc = img && img.id === receiptId ? img.src : null

  const shellOpen = open && !!receipt

  return (
    <ModalShell open={shellOpen} onBackdropClick={onClose}>
      {receipt ? (
        <div className="p-5">
          <ModalSheetHeader title="Receipt" onClose={onClose} />

          {/* Hero: merchant + total, mirroring the scan result card. */}
          <div className="flex items-center gap-3 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-4">
            {imgSrc ? (
              <Image
                src={imgSrc}
                alt="Receipt photo"
                width={64}
                height={88}
                unoptimized
                className="h-20 w-16 flex-shrink-0 rounded-lg border border-[var(--color-brand-border)] object-cover"
              />
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[var(--color-brand-text-primary)]">{receipt.merchant || 'Receipt'}</p>
              <p className="mt-0.5 truncate text-xs text-[var(--color-brand-text-muted)]">
                {receipt.receiptDate} · {receipt.category}
                {(() => {
                  const pm = paymentMethods.find((m) => m.id === receipt.paymentMethodId)
                  return pm ? ` · ${pm.name}` : ''
                })()}
              </p>
              <p className="mt-1.5 text-2xl font-semibold tabular-nums text-[var(--color-brand-text-primary)]">
                {receipt.amount.toFixed(2)} <span className="text-base text-[var(--color-brand-text-secondary)]">{receipt.currency}</span>
              </p>
            </div>
          </div>

          {receipt.items.length > 0 || receipt.charges.length > 0 ? (
            <div className="mt-3 rounded-xl border border-[var(--color-brand-border)] p-3">
              <p className="mb-2 text-xs font-semibold text-[var(--color-brand-text-secondary)]">Breakdown</p>

              {receipt.items.length > 0 ? (
                <ul className="space-y-1.5">
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
                <ul className="mt-2 space-y-1.5 border-t border-[var(--color-brand-border)] pt-2">
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
            </div>
          ) : null}

          {receipt.notes ? (
            <p className="mt-3 text-xs text-[var(--color-brand-text-muted)]">{receipt.notes}</p>
          ) : null}
        </div>
      ) : null}
    </ModalShell>
  )
}
