'use client'
import { useState } from 'react'
import { BellRing, ChevronRight } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { useSmsConfirmations } from '@/hooks/useSmsConfirmations'
import { SmsReviewSheet } from '@/components/features/dashboard/SmsReviewSheet'

/**
 * Compact dashboard entry point for SMS transactions awaiting review
 * (add-failed rescues and provisional-currency confirmations). Tapping opens
 * the review bottom sheet.
 */
export function SmsReviewChip() {
  const t = useT()
  const { pending, confirmItem, dismissItem, refetch } = useSmsConfirmations()
  const [open, setOpen] = useState(false)

  if (!pending.length && !open) return null

  return (
    <>
      {pending.length > 0 && (
        <button
          type="button"
          onClick={() => {
            setOpen(true)
            void refetch()
          }}
          className="flex min-h-[44px] w-full items-center gap-2.5 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-4 py-2.5 text-start hover:bg-[var(--color-brand-elevated)] transition-colors"
        >
          <BellRing className="h-4 w-4 shrink-0 text-[var(--color-brand-red)]" />
          <span className="flex-1 text-xs font-medium text-[var(--color-brand-text-primary)]">
            {t.smsReview.chip(pending.length)}
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-[var(--color-brand-text-muted)] rtl:rotate-180" />
        </button>
      )}

      <SmsReviewSheet
        open={open && pending.length > 0}
        onClose={() => setOpen(false)}
        items={pending}
        confirmItem={confirmItem}
        dismissItem={dismissItem}
      />
    </>
  )
}
