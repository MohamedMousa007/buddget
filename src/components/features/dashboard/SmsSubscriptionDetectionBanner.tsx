'use client'
import { MessageSquare } from 'lucide-react'
import { useSubscriptionDetector } from '@/hooks/useSubscriptionDetector'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { PROMPT_PRIORITY, useRegisterPrompts } from '@/lib/store/usePromptStore'
import { navigate } from '@/lib/navigation/navigate'
import { useT } from '@/lib/i18n'

/**
 * "Found 3 possible subscriptions · Review": one prompt for every recurring SMS charge the
 * user has not answered yet. It never creates anything itself; the review sheet does, after
 * the user confirms each find.
 */
export function SmsSubscriptionDetectionBanner() {
  const { finds } = useSubscriptionDetector()
  const t = useT()
  const setReviewOpen = useSettingsStore((s) => s.setSubscriptionReviewOpen)
  const sms = t.subscriptions.ui.sms

  useRegisterPrompts(
    'subscription-detection',
    finds.length === 0
      ? []
      : [
          {
            key: 'sub:detected',
            priority: PROMPT_PRIORITY.subscription,
            tone: 'brand' as const,
            icon: MessageSquare,
            title: sms.prompt(finds.length),
            description: sms.nothingAdded,
            actions: [
              {
                label: sms.review,
                variant: 'default' as const,
                onPress: () => {
                  setReviewOpen(true)
                  navigate('/subscriptions')
                },
              },
            ],
          },
        ],
  )

  return null
}
