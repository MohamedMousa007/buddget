'use client'
import { answersTo } from '@/lib/accounts/identity/accountRef'
import { useEffect, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { format } from 'date-fns'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { paydayCandidates } from '@/lib/income/paydayResolution'
import { methodLabel } from '@/components/features/flow/useFlowLedger'
import { useShortDate } from '@/hooks/useShortDate'
import type { Currency } from '@/lib/store/types'
import { ResolveGroupLabel, ResolveList, ResolveRow, ResolveSheet, ResolveTile } from '@/components/modals/ResolveSheet'
import { Button } from '@/components/ui/button'
import { useActionToast } from '@/components/ui/ActionToast'
import { TOAST_UNDO_MS } from '@/components/ui/toastQueue'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { useT } from '@/lib/i18n'
import { useWeekendFirstDay } from '@/hooks/useWeekStart'
import { categoryLabel } from '@/lib/i18n/categoryLabel'
import type { PendingConfirmation } from '@/hooks/useSmsConfirmations'
import { formatFixed2 } from '@/lib/utils/formatters'
import { MoveHorizontal } from 'lucide-react'
import { SwipeToDelete, type SwipeSide } from '@/components/expenses/SwipeToDelete'
import { useFlowLtCopy } from '@/lib/i18n/flowLtCopy'
import { AI_QUOTA_HOLD, createDeferred, dismissNeedsUndo, groupHeld, isCredit, isCurrencyOnly, runBatch } from '@/lib/sms/heldReview'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { CategoryIcon } from '@/components/dashboard/CategoryIcon'
import { categoryChipColors } from '@/lib/expenses/categoryChip'

/** An outgoing transfer not booked yet, from a known sender: the message can't tell a transfer from a payment. */
const isTransferAsk = (i: PendingConfirmation): boolean =>
  i.kind === 'instant_transfer_out' && !isCurrencyOnly(i) && i.failure_code !== 'sender_mismatch'

interface HeldMessagesSheetProps {
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
 * Held bank messages: one selectable row per message, one footer. Nothing is chosen for the user (these were held for a
 * reason) except the plain debits in Ready, which start ticked each time it opens; credits and currency checks are
 * chosen one by one, every row has a bin (and swipes left) to remove it, and an
 * unverified sender can only be confirmed from its own detail. Two flavours per row:
 *  - provisional currency (transaction exists) → confirming locks the currency; dismissing only stops the question
 *  - add-failed rescue (nothing created yet)   → confirming creates it; dismissing means it is never added (Undo for 8 s)
 */
/** The one line saying why a message waits, for holds the message text alone does not explain. */
const HELD_REASON_KEY = {
  sms_account_cap: 'heldAccountCap',
  [AI_QUOTA_HOLD]: 'heldAiQuota',
  unverified_reading: 'heldUnverifiedReading',
  ai_credit_new_sender: 'heldNewSenderCredit',
} as const
const heldReason = (code: string | null, s: Record<(typeof HELD_REASON_KEY)[keyof typeof HELD_REASON_KEY], string>): string | null =>
  code && code in HELD_REASON_KEY ? s[HELD_REASON_KEY[code as keyof typeof HELD_REASON_KEY]] : null

export function HeldMessagesSheet({ open, onClose, items, confirmItem, dismissItem, onConfirmedMatch }: HeldMessagesSheetProps) {
  const shortDate = useShortDate()
  const t = useT()
  const s = t.smsReview
  const lt = useFlowLtCopy()
  const toast = useActionToast()
  const { online } = useNetworkStatus()
  const weekendFirst = useWeekendFirstDay()
  const { incomeSources, incomeEvents, paymentMethods, monthStartDay, rates } = useFinanceStore(
    useShallow((st) => ({
      incomeSources: st.incomeSources,
      incomeEvents: st.incomeEvents,
      paymentMethods: st.paymentMethods,
      monthStartDay: st.settings.monthStartDay,
      rates: st.exchangeRates,
    })),
  )
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [failed, setFailed] = useState<Set<string>>(new Set())
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [swiped, setSwiped] = useState<{ id: string; side: SwipeSide } | null>(null)

  // "Don't add" is held back for the Undo window, then sent; a failure puts the rows back with the red chip.
  const [deferred] = useState(() =>
    createDeferred(async (ids) => {
      const res = await runBatch(ids, dismissItem)
      if (res.failed.length) {
        setHidden((h) => new Set([...h].filter((id) => !res.failed.includes(id))))
        setFailed((f) => new Set([...f, ...res.failed]))
      }
    }, TOAST_UNDO_MS),
  )
  useEffect(() => {
    const flush = () => { if (document.visibilityState === 'hidden') void deferred.flush() }
    const flushNow = () => void deferred.flush()
    document.addEventListener('visibilitychange', flush)
    window.addEventListener('pagehide', flushNow)
    return () => {
      document.removeEventListener('visibilitychange', flush)
      window.removeEventListener('pagehide', flushNow)
      void deferred.flush()
    }
  }, [deferred])

  const visible = useMemo(() => items.filter((i) => !hidden.has(i.id)), [items, hidden])
  // An outgoing transfer moves to "Take a look" with its own question (transfer, or spending?), never pre-ticked.
  const groups = useMemo(() => {
    const g = groupHeld(visible)
    return { ...g, ready: g.ready.filter((i) => !isTransferAsk(i)), check: [...g.ready.filter(isTransferAsk), ...g.check] }
  }, [visible])

  // "No, spending": confirm it, then open the expense it creates (once it has synced) so its category can be set.
  const { expenses } = useFinanceStore(useShallow((st) => ({ expenses: st.expenses })))
  const { setEditingExpenseId, setActiveModal } = useSettingsStore(useShallow((st) => ({ setEditingExpenseId: st.setEditingExpenseId, setActiveModal: st.setActiveModal })))
  const [editAfter, setEditAfter] = useState<string | null>(null)
  useEffect(() => {
    if (!editAfter) return
    const e = expenses.find((x) => x.smsLogId === editAfter)
    if (!e) return
    setEditingExpenseId(e.id)
    setActiveModal('editExpense')
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- consume the expense that just landed */
    setEditAfter(null)
  }, [editAfter, expenses, setEditingExpenseId, setActiveModal])

  // Credits that plausibly fill an open payday are confirmed straight into it ("Confirm and link").
  const matches = useMemo(() => {
    const out = new Map<string, ReviewMatch>()
    if (!open) return out
    const today = new Date()
    for (const item of visible) {
      if (!isCredit(item) || item.amount == null || !item.currency) continue
      const receivedDate = format(new Date(item.received_at), 'yyyy-MM-dd')
      const best = paydayCandidates({ amount: item.amount, currency: item.currency as Currency, receivedDate }, incomeSources, incomeEvents, monthStartDay, rates, today, weekendFirst)[0]
      if (!best?.plausible) continue
      const late = Math.round((Date.parse(receivedDate) - Date.parse(best.occ.dueDate)) / 86_400_000)
      out.set(item.id, { templateId: best.source.id, date: best.occ.dueDate, daysLate: Math.max(0, late) })
    }
    return out
  }, [open, visible, incomeSources, incomeEvents, monthStartDay, rates, weekendFirst])

  const chosen = visible.filter((i) => selected.has(i.id) && !(groups.locked as PendingConfirmation[]).includes(i))
  const n = chosen.length
  const close = () => {
    setSelected(new Set())
    setFailed(new Set())
    onClose()
  }

  // Everything was handled (confirmed, or held back for Undo): nothing left to show.
  useEffect(() => {
    if (open && items.length > 0 && visible.length === 0) onClose()
  }, [open, items.length, visible.length, onClose])

  // Plain debits in Ready start ticked each time the sheet opens; credits, currency checks and unverified senders
  // are still chosen one by one. Adjusted during render (not in an effect) so the first paint already shows the ticks.
  const [wasOpen, setWasOpen] = useState(false)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setSelected(new Set(groups.ready.map((i) => i.id)))
  }

  const toggle = (id: string) => setSelected((p) => { const q = new Set(p); if (q.has(id)) q.delete(id); else q.add(id); return q })

  const confirmMany = async (list: PendingConfirmation[]) => {
    if (busy || !online || list.length === 0) return
    setBusy(true)
    setFailed(new Set())
    const byId = new Map(list.map((i) => [i.id, i]))
    const res = await runBatch(list.map((i) => i.id), async (id) => {
      const item = byId.get(id)!
      const done = await confirmItem(id, isCurrencyOnly(item) ? (item.currency ?? undefined) : undefined)
      const match = matches.get(id)
      if (done && match) onConfirmedMatch(item, match)
      return done
    })
    setSelected((p) => new Set([...p].filter((id) => !res.ok.includes(id))))
    setFailed(new Set(res.failed))
    setBusy(false)
    if (res.failed.length === 0 && res.ok.length === visible.length) close()
  }

  const dismissMany = async (list: PendingConfirmation[]) => {
    if (busy || list.length === 0) return
    const ids = list.map((i) => i.id)
    setSelected((p) => new Set([...p].filter((id) => !ids.includes(id))))
    setFailed(new Set())
    if (!dismissNeedsUndo(list)) {
      // Currency-only rows: the transaction stays as it is, so there is nothing to take back.
      setBusy(true)
      const res = await runBatch(ids, dismissItem)
      setFailed(new Set(res.failed))
      setSelected((p) => new Set([...p, ...res.failed]))
      setBusy(false)
      return
    }
    setHidden((h) => new Set([...h, ...ids]))
    const handle = deferred.schedule(ids)
    toast(s.notAddedToast(ids.length), {
      undoLabel: t.common.undo,
      undo: () => {
        // The toast can outlive the window (it pauses while held), so say so rather than do nothing.
        if (handle.cancel()) setHidden((h) => new Set([...h].filter((id) => !ids.includes(id))))
        else toast(s.undoTooLate)
      },
    })
  }

  const row = (item: PendingConfirmation, locked: boolean) => {
    const title = item.clean_title ?? item.merchant ?? 'Bank transaction'
    const credit = isCredit(item)
    const currencyOnly = isCurrencyOnly(item)
    const match = matches.get(item.id)
    const pm = item.account_last4 ? paymentMethods.find((m) => answersTo(m, item.account_last4)) : undefined
    const instrument = item.account_last4
      ? pm
        ? methodLabel(pm)
        : s.newInstrument((item.payment_instrument as 'card' | 'account' | 'wallet' | null) ?? 'card', item.account_last4)
      : item.bank_name
    const detail = currencyOnly && !credit ? s.confirmCurrencyHelp : [credit || !item.category ? null : categoryLabel(t, item.category), instrument].filter(Boolean).join(' · ')
    const sub = [shortDate(item.received_at), detail].filter(Boolean).join(' · ')
    const amountText = item.amount != null ? `${credit ? '+' : '−'}${formatFixed2(item.amount)}` : ''
    const isFailed = failed.has(item.id)
    const chip = isFailed
      ? ({ tone: 'negative', text: s.couldntSave } as const)
      : match
        ? ({ tone: 'positive', text: [s.matchedTo(shortDate(match.date)), match.daysLate ? s.arrivedLate(match.daysLate) : null].filter(Boolean).join(' · ') } as const)
        : undefined
    const remove = () => {
      setSwiped(null)
      void dismissMany([item])
    }
    const ask = isTransferAsk(item)
    const colors = !credit && item.category ? categoryChipColors(item.category) : null
    return (
      <SwipeToDelete
        key={item.id}
        openSide={swiped?.id === item.id ? swiped.side : null}
        onOpenChange={(side) => setSwiped(side ? { id: item.id, side } : null)}
        onDelete={remove}
        deleteLabel={t.common.delete}
      >
      <ResolveRow
        look="list"
        remove={{ label: lt.held.remove(title), onPress: remove, disabled: busy }}
        state={locked ? 'locked' : ask && !isFailed ? 'plain' : isFailed ? 'failed' : selected.has(item.id) ? 'selected' : 'idle'}
        onToggle={locked || ask ? undefined : () => toggle(item.id)}
        leading={
          colors && item.category ? (
            <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-[11px]" style={{ background: colors.bg, color: colors.fg }}>
              <CategoryIcon category={item.category} className="size-5" />
            </span>
          ) : (
            <ResolveTile label={title} moneyIn={credit} />
          )
        }
        title={title}
        sub={ask ? lt.held.transferAsk : sub}
        subTone={ask ? 'var(--color-brand-amber)' : undefined}
        footer={
          ask ? (
            <div className="grid grid-cols-2 border-t border-[var(--color-brand-border)]">
              <Button variant="ghost" className="h-11 rounded-none font-semibold text-[var(--color-brand-primary-ink)]" disabled={busy || !online} onClick={() => void confirmMany([item])}>
                {lt.held.yesTransfer}
              </Button>
              <Button
                variant="ghost"
                className="h-11 rounded-none border-s border-[var(--color-brand-border)] font-semibold text-[var(--color-brand-primary-ink)]"
                disabled={busy || !online}
                onClick={() => {
                  setEditAfter(item.id)
                  void confirmMany([item])
                }}
              >
                {lt.held.noSpending}
              </Button>
            </div>
          ) : undefined
        }
        trailing={amountText ? <span className={credit ? 'text-[var(--color-brand-green)]' : undefined}>{amountText}</span> : undefined}
        chip={chip}
        label={[title, amountText, shortDate(item.received_at), chip?.text].filter(Boolean).join(', ')}
        detailLabels={{ show: s.seeMessage, hide: s.hideMessage }}
        detailDefaultOpen={locked || !!heldReason(item.failure_code, s)}
        detail={
          item.raw_body || locked || heldReason(item.failure_code, s) ? (
            <div className="flex flex-col gap-2 px-1">
              {item.raw_body ? <p dir="auto" className="font-mono-numbers text-[0.6875rem] leading-[1.45] text-[var(--color-brand-text-secondary)]">{item.raw_body}</p> : null}
              {heldReason(item.failure_code, s) ? <p className="text-xs text-[var(--color-brand-text-secondary)]" role="note">{heldReason(item.failure_code, s)}</p> : null}
              {locked ? (
                <>
                  <p className="text-xs text-[var(--color-brand-red)]" role="note">{s.unverifiedSender(item.sender ?? '?')}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button size="touch" disabled={busy || !online} onClick={() => void confirmMany([item])}>{s.confirmThisCredit}</Button>
                    <Button size="touch" variant="outline" disabled={busy} onClick={() => void dismissMany([item])}>{s.dismissN(1)}</Button>
                  </div>
                </>
              ) : null}
            </div>
          ) : undefined
        }
      />
      </SwipeToDelete>
    )
  }

  const allFailed = n > 0 && chosen.every((i) => failed.has(i.id))
  const allCredits = n > 0 && chosen.every(isCredit)
  // Nothing ticked: the button just closes ("Done"); every row has its own bin to remove it.
  // Currency checks are already in Flow: confirming them is not adding anything.
  const primaryLabel = n === 0 ? t.common.done : allFailed ? s.retryN(n) : chosen.every(isCurrencyOnly) ? s.confirmN(n) : lt.held.addThese(n)

  return (
    <ResolveSheet
      open={open}
      onClose={close}
      busy={busy}
      title={lt.held.title}
      subtitle={lt.held.sub}
      note={!online ? { text: s.offlineNote, tone: 'warning' } : failed.size > 0 ? { text: s.actionFailed, tone: 'error' } : undefined}
      primary={{ label: primaryLabel, onPress: () => (n === 0 ? close() : void confirmMany(chosen)), disabled: n > 0 && !online, loading: busy, variant: allCredits ? 'success' : 'default' }}
    >
      <p className="flex items-center gap-2 px-1 text-xs text-[var(--color-brand-text-muted)]">
        <MoveHorizontal className="size-4 shrink-0" aria-hidden />
        {lt.held.swipeTip}
      </p>
      {groups.ready.length > 0 ? (
        <>
          <ResolveGroupLabel>{s.groupReady(groups.ready.length)}</ResolveGroupLabel>
          <ResolveList>{groups.ready.map((i) => row(i, false))}</ResolveList>
        </>
      ) : null}
      {groups.check.length > 0 ? (
        <>
          <ResolveGroupLabel>{s.groupCheck(groups.check.length)}</ResolveGroupLabel>
          <ResolveList>{groups.check.map((i) => row(i, false))}</ResolveList>
        </>
      ) : null}
      {groups.locked.length > 0 ? (
        <>
          <ResolveGroupLabel>{s.groupUnverified(groups.locked.length)}</ResolveGroupLabel>
          <ResolveList>{groups.locked.map((i) => row(i, true))}</ResolveList>
        </>
      ) : null}
    </ResolveSheet>
  )
}
