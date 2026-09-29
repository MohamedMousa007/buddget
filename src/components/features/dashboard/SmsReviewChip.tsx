'use client'
import { useState } from 'react'
import { MessageSquareText } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { useSmsConfirmations } from '@/hooks/useSmsConfirmations'
import { SmsReviewSheet } from '@/components/features/dashboard/SmsReviewSheet'
import { PROMPT_PRIORITY, useRegisterPrompts } from '@/lib/store/usePromptStore'

/**
 * SMS transactions awaiting review (add-failed rescues, provisional-currency confirms).
 * Registers the `sms-review` prompt with the drop-down stack; "Review" opens the sheet.
 * The prompt resolves when the last item is handled — the queue empties and it drops out.
 */
export function SmsReviewChip() {
  const t = useT()
  const { pending, confirmItem, dismissItem, refetch } = useSmsConfirmations()
  const [open, setOpen] = useState(false)

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
    />
  )
}
