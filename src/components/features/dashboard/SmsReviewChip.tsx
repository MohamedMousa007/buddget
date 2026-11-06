'use client'
import { useEffect, useState } from 'react'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { MessageSquareText } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { useSmsConfirmations } from '@/hooks/useSmsConfirmations'
import { SmsReviewSheet } from '@/components/features/dashboard/SmsReviewSheet'
import { PROMPT_PRIORITY, useRegisterPrompts } from '@/lib/store/usePromptStore'
import { subscribeSmsReviewRequests } from '@/lib/sms/reviewRequest'

/**
 * SMS transactions awaiting review (add-failed rescues, provisional-currency confirms).
 * Registers the `sms-review` prompt with the drop-down stack; "Review" opens the sheet.
 * The prompt resolves when the last item is handled — the queue empties and it drops out.
 */
export function SmsReviewChip() {
  const t = useT()
  const { pending, confirmItem, dismissItem, refetch } = useSmsConfirmations()
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

  useRegisterPrompts(
    'sms-review',
    pending.length
      ? [
          {
            key: 'sms-review',
            priority: PROMPT_PRIORITY.sms,
            tone: 'brand',
            icon: MessageSquareText,
            title: t.smsReview.chip(pending.length),
            description: t.smsReview.subtitle,
            actions: [
              {
                label: t.prompts.review,
                variant: 'default',
                onPress: () => {
                  setOpen(true)
                  void refetch()
                },
              },
            ],
          },
        ]
      : [],
  )

  return (
    <SmsReviewSheet
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
