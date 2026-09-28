'use client'
import { useState } from 'react'
import { BellRing, ChevronRight } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { useSmsConfirmations } from '@/hooks/useSmsConfirmations'
import { SmsReviewSheet } from '@/components/features/dashboard/SmsReviewSheet'
import { SelectableCard } from '@/components/ui/SelectableCard'

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
        <SelectableCard
          as="action"
          surface="card"
          onClick={() => {
            setOpen(true)
            void refetch()
          }}
          className="min-h-11 gap-2.5 px-4 py-2.5"
        >
          <BellRing className="h-4 w-4 shrink-0 text-[var(--color-brand-primary-ink)]" />
          <span className="flex-1 text-xs font-medium text-[var(--color-brand-text-primary)]">
            {t.smsReview.chip(pending.length)}
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-[var(--color-brand-text-muted)] rtl:rotate-180" />
        </SelectableCard>
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
