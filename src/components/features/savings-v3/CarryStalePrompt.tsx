'use client'

import { RefreshCw } from 'lucide-react'
import { useCarryStatus } from '@/hooks/useCarryStatus'
import { PROMPT_PRIORITY, useRegisterPrompts, type Prompt } from '@/lib/store/usePromptStore'
import { settlePrompt } from '@/lib/prompts/settle'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useActionToast } from '@/components/ui/ActionToast'
import { monthNames } from '@/lib/i18n/dateFormat'
import { useLocale, useT } from '@/lib/i18n'
import { formatCurrency } from '@/lib/utils/formatters'

/**
 * Tells the user a closed month's savings carry no longer matches its rows, and updates it on their tap. Newest stale
 * month only. "Later" is remembered for that month and figure, so it returns only if the figure changes again.
 */
export function CarryStalePrompt() {
  const dict = useT()
  const t = dict.prompts
  const { locale } = useLocale()
  const showToast = useActionToast()
  const base = useFinanceStore((s) => s.settings.baseCurrency)
  const { staleCycles, refresh, apply } = useCarryStatus()
  const cycle = staleCycles[0]

  const prompts: Prompt[] = []
  if (cycle) {
    const key = `carryStale:${cycle.monthKey}:${Math.round(cycle.recomputed)}`
    const [y, m] = cycle.monthKey.split('-').map(Number)
    prompts.push({
      key,
      priority: PROMPT_PRIORITY.planChange + 20,
      tone: 'warning',
      icon: RefreshCw,
      title: t.carryStaleTitle,
      description: t.carryStaleBody(`${monthNames(locale)[m - 1]} ${y}`, formatCurrency(cycle.posted, base), formatCurrency(cycle.recomputed, base)),
      actions: [
        {
          label: t.carryStaleUpdate,
          variant: 'default',
          onPress: () => {
            void apply(cycle.monthKey).then((outcome) => {
              showToast(outcome === 'applied' ? t.carryStaleUpdated : dict.smsReview.actionFailed)
              return refresh()
            })
          },
        },
        { label: t.carryStaleLater, variant: 'secondary', onPress: () => settlePrompt(key) },
      ],
    })
  }
  useRegisterPrompts('carryStale', prompts)
  return null
}
