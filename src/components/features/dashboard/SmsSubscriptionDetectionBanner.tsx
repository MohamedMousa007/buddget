'use client'
import { Repeat } from 'lucide-react'
import { useSubscriptionDetector } from '@/hooks/useSubscriptionDetector'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { PROMPT_PRIORITY, useRegisterPrompts } from '@/lib/store/usePromptStore'
import { navigate } from '@/lib/navigation/navigate'
import { useT } from '@/lib/i18n'

/**
 * "We noticed a recurring charge — track it?" Registers `sub:<brandKey>` with the prompt
 * stack. Never creates the subscription itself: the user confirms in the add sheet, seeded
 * with the amount actually charged. Once tracked, the detector drops it and it resolves.
 */
export function SmsSubscriptionDetectionBanner() {
  const detected = useSubscriptionDetector()
  const t = useT()
  const openAddSubscriptionWithPrefill = useSettingsStore((s) => s.openAddSubscriptionWithPrefill)

  useRegisterPrompts(
    'subscription-detection',
    detected.map(({ brandKey, name, amount, currency, billingDay, months }) => ({
      key: `sub:${brandKey}`,
      priority: PROMPT_PRIORITY.subscription,
      tone: 'brand' as const,
      icon: Repeat,
      title: t.subscriptions.detectedTitle.replace('{brand}', name),
      description: t.prompts.subBody(`${amount.toLocaleString('en-US')} ${currency}`, billingDay, months),
      actions: [
        {
          label: t.subscriptions.detectedCta,
          variant: 'default' as const,
          onPress: () => {
            openAddSubscriptionWithPrefill({ brandKey, amount, currency, billingDay })
            navigate('/subscriptions')
          },
        },
      ],
    })),
  )

  return null
}
