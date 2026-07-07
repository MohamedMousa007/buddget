'use client'
import { useState } from 'react'
import { CheckCircle, Loader2 } from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import { useT } from '@/lib/i18n'
import type { PendingConfirmation } from '@/hooks/useSmsConfirmations'
import { SMS_BADGES, KIND_TO_BADGE } from '@/lib/sms/transactionTypes'
import type { SmsTransactionType } from '@/lib/sms/transactionTypes'

interface SmsReviewSheetProps {
  open: boolean
  onClose: () => void
  items: PendingConfirmation[]
  confirmItem: (logId: string, currency?: string) => Promise<boolean>
  dismissItem: (logId: string) => Promise<boolean>
}

/**
 * Bottom-sheet review queue for SMS transactions awaiting user action.
 * Two flavours per row:
 *  - provisional currency (transaction exists) → "Confirm EGP"
 *  - add-failed rescue (nothing created yet)   → "Add transaction"
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
    <ModalShell open={open} onBackdropClick={onClose} padContent panelClassName="!max-h-[min(80vh,640px)]">
      <div className="space-y-3 pb-2">
        <div>
          <h2 className="text-base font-semibold text-[var(--color-brand-text-primary)]">
            {t.smsReview.title}
          </h2>
          <p className="text-xs text-[var(--color-brand-text-muted)]">{t.smsReview.subtitle}</p>
        </div>

        {items.map((item) => {
          const badgeKey = item.kind ? (KIND_TO_BADGE[item.kind] as SmsTransactionType) : null
          const badge = badgeKey ? SMS_BADGES[badgeKey] : null
          const title = item.clean_title ?? item.merchant ?? 'Bank transaction'
          const provisional = Boolean(item.expense_id || item.income_id)
          const busy = busyId === item.id
          const formattedAmount =
            item.amount != null ? `${item.currency ?? ''} ${item.amount.toLocaleString()}` : null

          return (
            <div
              key={item.id}
              className="rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-4 py-3"
            >
              <div className="flex items-center gap-2 min-w-0">
                {badge && (
                  <span
                    className={`shrink-0 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${badge.color}`}
                  >
                    {badge.icon} {badge.label}
                  </span>
                )}
                <p className="text-sm font-medium text-[var(--color-brand-text-primary)] truncate">
                  {title}
                </p>
              </div>
              {formattedAmount && (
                <p className="mt-1 font-mono text-lg font-semibold text-[var(--color-brand-text-primary)]">
                  {formattedAmount}
                </p>
              )}
              <p className="mt-0.5 text-xs text-[var(--color-brand-text-muted)]">
                {provisional ? t.smsReview.confirmCurrencyHelp : null}
                {item.bank_name ? (
                  <span className={provisional ? 'ms-1.5' : undefined}>
                    {item.bank_name}
                    {item.account_last4 ? ` ••••${item.account_last4}` : ''}
                  </span>
                ) : null}
              </p>
              <div className="mt-2.5 flex items-center gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void run(item.id, () => confirmItem(item.id, provisional ? (item.currency ?? undefined) : undefined))}
                  className="flex min-h-11 items-center gap-1.5 rounded-xl bg-[var(--color-brand-green)]/10 px-4 text-sm font-medium text-[var(--color-brand-green)] disabled:opacity-60"
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4" />
                  )}
                  {provisional && item.currency
                    ? t.smsReview.confirmCurrencyBtn(item.currency)
                    : t.smsReview.addTransaction}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void run(item.id, () => dismissItem(item.id))}
                  className="min-h-11 rounded-xl px-4 text-sm text-[var(--color-brand-text-muted)] disabled:opacity-60"
                >
                  {t.smsReview.dismiss}
                </button>
              </div>
              {failedId === item.id ? (
                <p className="mt-1.5 text-xs text-[var(--color-brand-red)]" role="alert">
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
