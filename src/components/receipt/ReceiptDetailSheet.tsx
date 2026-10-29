'use client'

import { categoryLabel } from '@/lib/i18n/categoryLabel'
import { formatFixed2 } from '@/lib/utils/formatters'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useShallow } from 'zustand/react/shallow'
import { ModalShell } from '@/components/modals/ModalShell'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { Card } from '@/components/ui/card'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { readReceiptImage } from '@/lib/native/receiptImages'
import { useT } from '@/lib/i18n'

/** Read-only view of a scanned receipt's itemized breakdown (items + charges). */
/** Receipt rows come from the AI scan; a missing number must not crash the sheet. */
const money = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) ? `${n < 0 ? '-' : ''}${formatFixed2(n)}` : '—')

export function ReceiptDetailSheet({
  receiptId,
  open,
  onClose,
}: {
  receiptId: string | null
  open: boolean
  onClose: () => void
}) {
  const tAll = useT()
  const t = tAll.receiptDetail
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
          <V3SheetHeader title={t.title} onClose={onClose} />

          {/* Hero: merchant + total, mirroring the scan result card. */}
          <Card padding="md" className="flex items-center gap-3">
            {imgSrc ? (
              <Image
                src={imgSrc}
                alt={t.photoAlt}
                width={64}
                height={88}
                unoptimized
                className="h-20 w-16 flex-shrink-0 rounded-lg border border-[var(--color-brand-border)] object-cover"
              />
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[var(--color-brand-text-primary)]">{receipt.merchant || t.defaultMerchant}</p>
              <p className="mt-0.5 truncate text-xs text-[var(--color-brand-text-muted)]">
                {receipt.receiptDate} · {categoryLabel(tAll, receipt.category)}
                {(() => {
                  const pm = paymentMethods.find((m) => m.id === receipt.paymentMethodId)
                  return pm ? ` · ${pm.name}` : ''
                })()}
              </p>
              <p className="mt-1.5 text-2xl font-semibold tabular-nums text-[var(--color-brand-text-primary)]">
                {money(receipt.amount)} <span className="text-base text-[var(--color-brand-text-secondary)]">{receipt.currency}</span>
              </p>
            </div>
          </Card>

          {receipt.items.length > 0 || receipt.charges.length > 0 ? (
            <Card radius="sm" padding="sm" className="mt-3">
              <p className="mb-2 text-xs font-semibold text-[var(--color-brand-text-secondary)]">{t.breakdown}</p>

              {receipt.items.length > 0 ? (
                <ul className="space-y-1.5">
                  {receipt.items.map((it, i) => (
                    <li key={`item-${i}`} className="flex items-baseline gap-2 text-sm">
                      <span className="flex-1 truncate text-[var(--color-brand-text-primary)]">
                        {it.qty && it.qty > 1 ? `${it.qty}× ` : ''}{it.name}
                      </span>
                      <span className="tabular-nums text-[var(--color-brand-text-secondary)]">
                        {money(it.price)} {receipt.currency}
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
                        {money(c.amount)} {receipt.currency}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </Card>
          ) : null}

          {receipt.notes ? (
            <p className="mt-3 text-xs text-[var(--color-brand-text-muted)]">{receipt.notes}</p>
          ) : null}
        </div>
      ) : null}
    </ModalShell>
  )
}
