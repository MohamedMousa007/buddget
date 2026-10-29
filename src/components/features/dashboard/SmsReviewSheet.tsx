'use client'
import { useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { format } from 'date-fns'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { paydayCandidates } from '@/lib/income/paydayResolution'
import { methodLabel } from '@/components/features/flow/useFlowLedger'
import { useShortDate } from '@/hooks/useShortDate'
import type { Currency } from '@/lib/store/types'
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
  /** A credit confirmed with its matched payday: the caller links the income it creates. */
  onConfirmedMatch: (item: PendingConfirmation, target: { templateId: string; date: string }) => void
}

/** The payday an SMS credit plausibly fills, from the same matcher as Flow's prompts. */
export interface ReviewMatch {
  templateId: string
  date: string
  daysLate: number
}

/**
 * Review transactions (screen 09): one card per SMS awaiting action — the original text,
 * Buddgy's reading of it, and two terminal answers. Two flavours per row:
 *  - provisional currency (transaction exists) → confirming locks the currency
 *  - add-failed rescue (nothing created yet)   → confirming creates it
 */
export function SmsReviewSheet({ open, onClose, items, confirmItem, dismissItem, onConfirmedMatch }: SmsReviewSheetProps) {
  const shortDate = useShortDate()
  const t = useT()
  const { incomeSources, incomeEvents, paymentMethods, monthStartDay, rates } = useFinanceStore(
    useShallow((s) => ({
      incomeSources: s.incomeSources,
      incomeEvents: s.incomeEvents,
      paymentMethods: s.paymentMethods,
      monthStartDay: s.settings.monthStartDay,
      rates: s.exchangeRates,
    })),
  )
  // Credits that plausibly fill an open payday are confirmed straight into it ("Confirm and link").
  const matches = useMemo(() => {
    const out = new Map<string, ReviewMatch>()
    if (!open) return out
    const today = new Date()
    for (const item of items) {
      if (!item.kind || !CREDIT_KINDS.has(item.kind) || item.amount == null || !item.currency) continue
      const receivedDate = format(new Date(item.received_at), 'yyyy-MM-dd')
      const best = paydayCandidates({ amount: item.amount, currency: item.currency as Currency, receivedDate }, incomeSources, incomeEvents, monthStartDay, rates, today)[0]
      if (!best?.plausible) continue
      const late = Math.round((Date.parse(receivedDate) - Date.parse(best.occ.dueDate)) / 86_400_000)
      out.set(item.id, { templateId: best.source.id, date: best.occ.dueDate, daysLate: Math.max(0, late) })
    }
    return out
  }, [open, items, incomeSources, incomeEvents, monthStartDay, rates])
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
    <ModalShell open={open} onBackdropClick={onClose} panelClassName="!max-h-[min(80dvh,640px)]">
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
          const match = matches.get(item.id)
          const pm = item.account_last4 ? paymentMethods.find((m) => m.last4 === item.account_last4) : undefined
          const instrument = item.account_last4
            ? pm
              ? methodLabel(pm)
              : t.smsReview.newInstrument((item.payment_instrument as 'card' | 'account' | 'wallet' | null) ?? 'card', item.account_last4)
            : item.bank_name
          const sub = match
            ? [t.smsReview.matchedTo(shortDate(match.date)), match.daysLate ? t.smsReview.arrivedLate(match.daysLate) : null].filter(Boolean).join(' · ')
            : provisional && !credit
              ? t.smsReview.confirmCurrencyHelp
              : [credit ? null : item.category, instrument].filter(Boolean).join(' · ')
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
                  variant={match ? 'success' : 'default'}
                  size="touch"
                  loading={busy}
                  onClick={() =>
                    void run(item.id, async () => {
                      const ok = await confirmItem(item.id, provisional ? (item.currency ?? undefined) : undefined)
                      if (ok && match) onConfirmedMatch(item, match)
                      return ok
                    })
                  }
                >
                  {match ? t.smsReview.confirmAndLink : t.common.confirm}
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
