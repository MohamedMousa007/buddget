'use client'
import { useEffect, useState } from 'react'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSmsConfirmations } from '@/hooks/useSmsConfirmations'
import { HeldMessagesSheet } from '@/components/features/dashboard/HeldMessagesSheet'
import { usePendingSmsStore } from '@/lib/store/usePendingSmsStore'
import { subscribeSmsReviewRequests } from '@/lib/sms/reviewRequest'

/**
 * Owns the held-messages sheet for the whole app (mounted once in the shell): the fetch of messages awaiting review
 * (add-failed rescues, provisional-currency confirms), the open state, a push tap that asks for the sheet, and linking
 * a confirmed credit to its payday once its income event has synced. It shows nothing of its own: the Flow row and the
 * Inbox open the sheet, and read the count it publishes.
 */
export function HeldMessagesHost() {
  const { pending, confirmItem, dismissItem, refetch } = useSmsConfirmations()
  const setHeld = usePendingSmsStore((s) => s.setHeld)
  const [open, setOpen] = useState(false)
  // SMS credit log id → the payday it was confirmed into, until its income event exists.
  // ponytail: session-only; if the app restarts before the event syncs, Flow's match prompt asks instead.
  const [toLink, setToLink] = useState<Record<string, { templateId: string; date: string }>>({})
  const incomeEvents = useFinanceStore((s) => s.incomeEvents)
  const updateIncomeEvent = useFinanceStore((s) => s.updateIncomeEvent)

  // A push tap on a held SMS opens the review sheet; it never confirms by itself.
  useEffect(() => subscribeSmsReviewRequests(() => {
    setOpen(true)
    void refetch()
  }), [refetch])

  // §8.0: link by payday (occurrenceDate); the event keeps the day the money arrived.
  useEffect(() => {
    const ids = Object.keys(toLink)
    if (!ids.length) return
    const done: string[] = []
    for (const e of incomeEvents) {
      const target = e.smsLogId ? toLink[e.smsLogId] : undefined
      if (!target) continue
      if (!e.templateId) updateIncomeEvent(e.id, { templateId: target.templateId, occurrenceDate: target.date, status: 'confirmed' })
      done.push(e.smsLogId!)
    }
    if (done.length) {
      /* eslint-disable-next-line react-hooks/set-state-in-effect -- consume the links that just landed */
      setToLink((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => !done.includes(k))))
    }
  }, [incomeEvents, toLink, updateIncomeEvent])

  // The one count the Flow row and the Inbox read; zero again when the host goes away.
  const oldest = pending.length ? Math.min(...pending.map((p) => Date.parse(p.received_at)).filter((n) => Number.isFinite(n))) : null
  const since = oldest != null && Number.isFinite(oldest) ? oldest : null
  useEffect(() => setHeld(pending.length, since), [pending.length, since, setHeld])
  useEffect(() => () => setHeld(0), [setHeld])

  return (
    <HeldMessagesSheet
      open={open && pending.length > 0}
      onClose={() => setOpen(false)}
      items={pending}
      confirmItem={confirmItem}
      dismissItem={dismissItem}
      onConfirmedMatch={(item, target) => {
        if (item.income_id) updateIncomeEvent(item.income_id, { templateId: target.templateId, occurrenceDate: target.date, status: 'confirmed' })
        else setToLink((prev) => ({ ...prev, [item.id]: target }))
      }}
    />
  )
}
