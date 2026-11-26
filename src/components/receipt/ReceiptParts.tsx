'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import { X } from 'lucide-react'
import type { ReceiptItem } from '@/lib/store/types'
import { IconButton } from '@/components/ui/IconButton'
import { readReceiptImage } from '@/lib/native/receiptImages'
import { useDismissable } from '@/hooks/useDismissable'
import { useDialogFocus } from '@/hooks/useDialogFocus'
import { useScrollLock } from '@/lib/ui/scrollLock'
import { formatFixed2 } from '@/lib/utils/formatters'
import { useFlowLtCopy } from '@/lib/i18n/flowLtCopy'

/** Receipt rows come from the AI scan; a missing number must not crash the view. */
export const receiptMoney = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) ? `${n < 0 ? '−' : ''}${formatFixed2(Math.abs(n))}` : '—')

/** One printed line: the name, "2 × 42.50" when bought more than once, and the line total (`price` is the line total). */
export function ReceiptItemRow({ item }: { item: ReceiptItem }) {
  const qty = item.qty && item.qty > 1 ? item.qty : 0
  return (
    <div className="flex items-baseline gap-2 py-1.5 text-[0.84375rem]">
      <span dir="auto" className="min-w-0 flex-1 truncate text-[var(--color-brand-text-primary)]">{item.name}</span>
      {qty ? (
        <span dir="ltr" className="font-mono-numbers text-xs text-[var(--color-brand-text-muted)]">
          {qty} × {receiptMoney(item.price / qty)}
        </span>
      ) : null}
      <span dir="ltr" className="font-mono-numbers font-medium text-[var(--color-brand-text-primary)]">{receiptMoney(item.price)}</span>
    </div>
  )
}

/** The scan's photo for a receipt, read from the device; `null` while loading or when none was kept. */
export function useReceiptImage(receiptId: string | null | undefined, enabled = true): string | null {
  const [img, setImg] = useState<{ id: string; src: string } | null>(null)
  useEffect(() => {
    if (!enabled || !receiptId) return
    let stale = false
    void readReceiptImage(receiptId).then((src) => {
      if (!stale && src) setImg({ id: receiptId, src })
    })
    return () => { stale = true }
  }, [enabled, receiptId])
  return img && img.id === receiptId ? img.src : null
}

/**
 * The receipt photo full screen, fitted and lightly enhanced (contrast) so it can be shown at the store for an
 * exchange or a refund. Escape, Android back and the close button dismiss it.
 */
export function ReceiptImageViewer({ open, src, title, sub, onClose }: { open: boolean; src: string; title: string; sub?: string; onClose: () => void }) {
  const lt = useFlowLtCopy()
  const panelRef = useRef<HTMLDivElement>(null)
  useDismissable(open, onClose)
  useScrollLock(open)
  useDialogFocus(open, panelRef, true)
  if (!open || typeof document === 'undefined') return null
  return createPortal(
    <div
      ref={panelRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[140] flex flex-col bg-[color-mix(in_oklab,black_88%,transparent)] pb-[max(env(safe-area-inset-bottom),16px)] pt-[max(env(safe-area-inset-top),12px)] text-white outline-none"
    >
      <div className="flex shrink-0 items-center gap-3 px-4 py-2">
        <IconButton variant="overlay" shape="round" aria-label={lt.receipt.close} onClick={onClose}>
          <X />
        </IconButton>
        <div className="min-w-0 flex-1 text-center">
          <p dir="auto" className="truncate text-[0.9375rem] font-semibold">{title}</p>
          {sub ? <p className="truncate text-xs text-white/70">{sub}</p> : null}
        </div>
        <span className="size-11 shrink-0" aria-hidden />
      </div>
      <div className="relative min-h-0 flex-1 px-4 py-3">
        <Image src={src} alt={title} fill unoptimized sizes="100vw" className="object-contain [filter:contrast(1.12)_brightness(1.04)]" />
      </div>
      <p className="shrink-0 px-6 pt-2 text-center text-[0.8125rem] text-white/80">{lt.receipt.showAtStore}</p>
    </div>,
    document.body,
  )
}
