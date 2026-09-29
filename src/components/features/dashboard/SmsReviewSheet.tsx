'use client'
import { useState } from 'react'
import { ModalShell } from '@/components/modals/ModalShell'
import { ModalTitle } from '@/components/modals/ModalTitle'
import { BuddgyIcon } from '@/components/ai/BuddgyIcon'
import { useT } from '@/lib/i18n'
import type { PendingConfirmation } from '@/hooks/useSmsConfirmations'
import { formatFixed2 } from '@/lib/utils/formatters'
import { Button } from '@/components/ui/button'

/** Kinds that are money coming in: the amount reads +, green, and confirming is a `success`. */
const CREDIT_KINDS = new Set(['income', 'instant_transfer_in', 'refund'])

interface SmsReviewSheetProps {
  open: boolean
  onClose: () => void
  items: PendingConfirmation[]
  confirmItem: (logId: string, currency?: string) => Promise<boolean>
  dismissItem: (logId: string) => Promise<boolean>
}

/**
 * Review transactions (screen 09): one card per SMS awaiting action — the original text,
 * Buddgy's reading of it, and two terminal answers. Two flavours per row:
 *  - provisional currency (transaction exists) → confirming locks the currency
 *  - add-failed rescue (nothing created yet)   → confirming creates it
 */
export function SmsReviewSheet({ open, onClose, items, confirmItem, dismissItem }: SmsReviewSheetProps) {
  const t = useT()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [failedId, setFailedId] = useState<string | null>(null)

  const run = async (id: string, action: () => Promise<boolean>) => {
    setBusyId(id)
    setFailedId(null)
    const ok = await action()
    if (!ok) setFailedId(id)
    // Handled the last item — the queue is done, close the sheet.
    else if (items.length === 1) onClose()
    setBusyId(null)
  }

  return (
    <ModalShell open={open} onBackdropClick={onClose} panelClassName="!max-h-[min(80vh,640px)]">
      <div className="flex flex-col gap-3 px-4 pb-[max(env(safe-area-inset-bottom,0px),20px)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <ModalTitle>{t.smsReview.title}</ModalTitle>
            <p className="mt-0.5 text-xs text-[var(--color-brand-text-muted)]">{t.smsReview.subtitle}</p>
          </div>
          <BuddgyIcon size={22} aria-hidden />
        </div>

        {items.map((item) => {
          const title = item.clean_title ?? item.merchant ?? 'Bank transaction'
          const provisional = Boolean(item.expense_id || item.income_id)
          const credit = item.kind ? CREDIT_KINDS.has(item.kind) : false
          const busy = busyId === item.id
          const sub = provisional
            ? t.smsReview.confirmCurrencyHelp
            : [item.bank_name, item.account_last4 ? `•• ${item.account_last4}` : null].filter(Boolean).join(' ')
          return (
            <div
              key={item.id}
              className="flex flex-col gap-2.5 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] p-3"
            >
              {item.raw_body ? (
                <p className="font-mono-numbers text-[11px] leading-[1.45] text-[var(--color-brand-text-muted)]">{item.raw_body}</p>
              ) : null}
              <div className="flex items-center justify-between gap-2.5">
                <span className="min-w-0">
                  <span className="block text-[14.5px] font-bold text-[var(--color-brand-text-primary)]">{title}</span>
                  {sub ? <span className="block text-[12.5px] text-[var(--color-brand-text-secondary)]">{sub}</span> : null}
                </span>
                {item.amount != null ? (
                  <span
                    className="whitespace-nowrap font-mono-numbers text-[15px] font-semibold"
                    style={{ color: credit ? 'var(--color-brand-green)' : 'var(--color-brand-text-primary)' }}
                  >
                    {credit ? '+' : '−'}
                    {formatFixed2(item.amount)}
                  </span>
                ) : null}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={credit ? 'success' : 'default'}
                  size="touch"
                  loading={busy}
                  onClick={() => void run(item.id, () => confirmItem(item.id, provisional ? (item.currency ?? undefined) : undefined))}
                >
                  {t.common.confirm}
                </Button>
                <Button variant="outline" size="touch" disabled={busy} onClick={() => void run(item.id, () => dismissItem(item.id))}>
                  {t.smsReview.dismiss}
                </Button>
              </div>
              {failedId === item.id ? (
                <p className="text-xs text-[var(--color-brand-red)]" role="alert">
                  {t.smsReview.actionFailed}
                </p>
              ) : null}
            </div>
          )
        })}
      </div>
    </ModalShell>
  )
}
