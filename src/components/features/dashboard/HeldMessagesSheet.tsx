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
import { ResolveGroupLabel, ResolveRow, ResolveSheet, ResolveTile } from '@/components/modals/ResolveSheet'
import { Button } from '@/components/ui/button'
import { useActionToast } from '@/components/ui/ActionToast'
import { TOAST_UNDO_MS } from '@/components/ui/toastQueue'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { useT } from '@/lib/i18n'
import { useWeekendFirstDay } from '@/hooks/useWeekStart'
import { categoryLabel } from '@/lib/i18n/categoryLabel'
import type { PendingConfirmation } from '@/hooks/useSmsConfirmations'
import { formatFixed2 } from '@/lib/utils/formatters'
import { createDeferred, dismissKind, dismissNeedsUndo, groupHeld, isCredit, isCurrencyOnly, runBatch } from '@/lib/sms/heldReview'

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
 * reason); "Select all ready" picks plain debits only, credits and currency checks are chosen one by one, and an
 * unverified sender can only be confirmed from its own detail. Two flavours per row:
 *  - provisional currency (transaction exists) → confirming locks the currency; dismissing only stops the question
 *  - add-failed rescue (nothing created yet)   → confirming creates it; dismissing means it is never added (Undo for 8 s)
 */
export function HeldMessagesSheet({ open, onClose, items, confirmItem, dismissItem, onConfirmedMatch }: HeldMessagesSheetProps) {
  const shortDate = useShortDate()
  const t = useT()
  const s = t.smsReview
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
  const groups = useMemo(() => groupHeld(visible), [visible])

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

  const toggle = (id: string) => setSelected((p) => { const q = new Set(p); if (q.has(id)) q.delete(id); else q.add(id); return q })
  const selectAllReady = () => setSelected((p) => new Set([...p, ...groups.ready.map((i) => i.id)]))

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
        if (handle.cancel()) setHidden((h) => new Set([...h].filter((id) => !ids.includes(id))))
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
    return (
      <ResolveRow
        key={item.id}
        state={locked ? 'locked' : isFailed ? 'failed' : selected.has(item.id) ? 'selected' : 'idle'}
        onToggle={locked ? undefined : () => toggle(item.id)}
        leading={<ResolveTile label={title} moneyIn={credit} />}
        title={title}
        sub={sub}
        trailing={amountText ? <span className={credit ? 'text-[var(--color-brand-green)]' : undefined}>{amountText}</span> : undefined}
        chip={chip}
        label={[title, amountText, shortDate(item.received_at), chip?.text].filter(Boolean).join(', ')}
        detailLabels={{ show: s.seeMessage, hide: s.hideMessage }}
        detailDefaultOpen={locked}
        detail={
          item.raw_body || locked ? (
            <div className="flex flex-col gap-2 px-1">
              {item.raw_body ? <p dir="auto" className="font-mono-numbers text-[0.6875rem] leading-[1.45] text-[var(--color-brand-text-secondary)]">{item.raw_body}</p> : null}
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
    )
  }

  const kind = dismissKind(chosen)
  const secondaryLabel = kind === 'keepAsIs' ? s.keepAsIsN(n) : kind === 'dontAdd' ? s.dontAddN(n) : s.dismissN(n)
  const allFailed = n > 0 && chosen.every((i) => failed.has(i.id))
  const allCredits = n > 0 && chosen.every(isCredit)
  const allMatched = allCredits && chosen.every((i) => matches.has(i.id))
  const primaryLabel = allFailed ? s.retryN(n) : allMatched ? s.confirmLinkN(n) : s.confirmN(n)
  const sections = [groups.ready, groups.check, groups.locked].filter((g) => g.length > 0).length

  return (
    <ResolveSheet
      open={open}
      onClose={close}
      busy={busy}
      title={s.sheetTitle(visible.length)}
      subtitle={s.sheetSubtitle}
      headerAction={groups.ready.length > 0 ? { label: s.selectAllReady, onPress: selectAllReady } : undefined}
      note={!online ? { text: s.offlineNote, tone: 'warning' } : failed.size > 0 ? { text: s.actionFailed, tone: 'error' } : undefined}
      primary={{ label: primaryLabel, onPress: () => void confirmMany(chosen), disabled: n === 0 || !online, loading: busy, variant: allCredits ? 'success' : 'default' }}
      secondary={{ label: secondaryLabel, onPress: () => void dismissMany(chosen), disabled: n === 0 }}
    >
      {groups.ready.length > 0 ? (
        <>
          {sections > 1 ? <ResolveGroupLabel>{s.groupReady(groups.ready.length)}</ResolveGroupLabel> : null}
          {groups.ready.map((i) => row(i, false))}
        </>
      ) : null}
      {groups.check.length > 0 ? (
        <>
          {sections > 1 ? <ResolveGroupLabel>{s.groupCheck(groups.check.length)}</ResolveGroupLabel> : null}
          {groups.check.map((i) => row(i, false))}
        </>
      ) : null}
      {groups.locked.length > 0 ? (
        <>
          <ResolveGroupLabel>{s.groupUnverified(groups.locked.length)}</ResolveGroupLabel>
          {groups.locked.map((i) => row(i, true))}
        </>
      ) : null}
    </ResolveSheet>
  )
}
