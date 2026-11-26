'use client'

import { categoryLabel } from '@/lib/i18n/categoryLabel'
import { useState } from 'react'
import { Image as ImageIcon, Receipt as ReceiptIcon } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { ModalShell } from '@/components/modals/ModalShell'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { Button } from '@/components/ui/button'
import { methodLabel } from '@/components/features/flow/useFlowLedger'
import { ReceiptImageViewer, ReceiptItemRow, receiptMoney, useReceiptImage } from '@/components/receipt/ReceiptParts'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useShortDate } from '@/hooks/useShortDate'
import { useT } from '@/lib/i18n'
import { useFlowLtCopy } from '@/lib/i18n/flowLtCopy'
import { cn } from '@/lib/utils'

const BOX = 'rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)]'

/**
 * A scanned receipt, read-only: the store and when it was scanned, what paid it and the total, the photo one tap away
 * (fitted and enhanced, to show at the store), then every printed line, the subtotal, charges and discounts, and the
 * total.
 */
export function ReceiptDetailSheet({
  receiptId,
  open,
  onClose,
  zIndexClassName,
}: {
  receiptId: string | null
  open: boolean
  onClose: () => void
  zIndexClassName?: string
}) {
  const tAll = useT()
  const t = tAll.receiptDetail
  const lt = useFlowLtCopy()
  const shortDate = useShortDate()
  const { receipt, paymentMethods } = useFinanceStore(
    useShallow((s) => ({
      receipt: receiptId ? s.receipts.find((r) => r.id === receiptId) ?? null : null,
      paymentMethods: s.paymentMethods,
    })),
  )
  const imgSrc = useReceiptImage(receiptId, open)
  const [viewing, setViewing] = useState(false)

  const shellOpen = open && !!receipt
  const items = receipt?.items ?? []
  const subtotal = items.reduce((s, it) => s + (Number.isFinite(it.price) ? it.price : 0), 0)
  const pm = receipt ? methodLabel(paymentMethods.find((m) => m.id === receipt.paymentMethodId)) : null
  const merchant = receipt?.merchant || t.defaultMerchant

  return (
    <ModalShell open={shellOpen} onBackdropClick={onClose} zIndexClassName={zIndexClassName}>
      {receipt ? (
        <div className="flex flex-col gap-4 px-4 pb-[max(env(safe-area-inset-bottom,0px),20px)]">
          <V3SheetHeader title={lt.receipt.title} subtitle={lt.receipt.sub} onClose={onClose} />

          <section className={cn(BOX, 'p-4')}>
            <div className="flex items-center gap-3">
              <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary-ink)]">
                <ReceiptIcon className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span dir="auto" className="block truncate font-semibold text-[var(--color-brand-text-primary)]">{merchant}</span>
                <span className="block text-xs text-[var(--color-brand-text-secondary)]">
                  {lt.receipt.scanned(shortDate(receipt.createdAt))} · {categoryLabel(tAll, receipt.category)}
                </span>
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <span className="rounded-xl bg-[var(--color-brand-elevated)] px-3 py-2">
                <span className="block text-[var(--color-brand-text-muted)]">{lt.receipt.paidWith}</span>
                <b className="mt-0.5 block truncate font-semibold text-[var(--color-brand-text-primary)]">{pm ?? '—'}</b>
              </span>
              <span className="rounded-xl bg-[var(--color-brand-elevated)] px-3 py-2">
                <span className="block text-[var(--color-brand-text-muted)]">{lt.receipt.total}</span>
                <b dir="ltr" className="mt-0.5 block font-mono-numbers font-semibold text-[var(--color-brand-text-primary)]">
                  {receiptMoney(receipt.amount)} {receipt.currency}
                </b>
              </span>
            </div>
            {imgSrc ? (
              <Button variant="ghost" size="touch" className="mt-3 w-full bg-[var(--color-brand-primary-soft)] font-semibold text-[var(--color-brand-primary-ink)] hover:bg-[var(--color-brand-primary-soft)]/70" onClick={() => setViewing(true)}>
                <ImageIcon className="size-4" aria-hidden />
                {lt.receipt.viewReceiptImage}
              </Button>
            ) : null}
          </section>

          {items.length > 0 || receipt.charges.length > 0 ? (
            <section>
              <h3 className="mb-2 px-1 text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-[var(--color-brand-text-muted)]">{lt.receipt.items(items.length)}</h3>
              <div className={cn(BOX, 'px-4 py-1.5')}>
                {items.map((it, i) => (
                  <ReceiptItemRow key={`item-${i}`} item={it} />
                ))}
                <div className="mt-1 border-t border-dashed border-[var(--color-brand-border-strong)] pt-1.5">
                  {items.length > 0 ? (
                    <div className="flex items-baseline justify-between py-1.5 text-[0.84375rem] text-[var(--color-brand-text-primary)]">
                      <span>{lt.receipt.subtotal}</span>
                      <span dir="ltr" className="font-mono-numbers font-medium">{receiptMoney(subtotal)}</span>
                    </div>
                  ) : null}
                  {receipt.charges.map((c, i) => {
                    const off = c.type === 'discount' || c.amount < 0
                    return (
                      <div
                        key={`charge-${i}`}
                        className={cn('flex items-baseline justify-between py-1.5 text-[0.84375rem]', off ? 'text-[var(--color-brand-green)]' : 'text-[var(--color-brand-text-secondary)]')}
                      >
                        <span dir="auto" className="min-w-0 truncate">{c.label}</span>
                        <span dir="ltr" className="font-mono-numbers font-medium">{off ? receiptMoney(-Math.abs(c.amount)) : receiptMoney(c.amount)}</span>
                      </div>
                    )
                  })}
                  <div className="flex items-baseline justify-between py-2 text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">
                    <span>{lt.receipt.total}</span>
                    <span dir="ltr" className="font-mono-numbers">{receiptMoney(receipt.amount)} {receipt.currency}</span>
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          <p className="px-1 text-xs leading-relaxed text-[var(--color-brand-text-muted)]">
            {receipt.notes ? `${receipt.notes} · ` : ''}
            {lt.receipt.note(categoryLabel(tAll, receipt.category))}
          </p>
        </div>
      ) : null}
      {imgSrc ? (
        <ReceiptImageViewer
          open={viewing}
          src={imgSrc}
          title={lt.receipt.imageTitle(merchant)}
          sub={receipt ? lt.receipt.imageSub(shortDate(receipt.receiptDate)) : undefined}
          onClose={() => setViewing(false)}
        />
      ) : null}
    </ModalShell>
  )
}
