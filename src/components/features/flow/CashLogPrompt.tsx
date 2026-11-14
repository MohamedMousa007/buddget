'use client'

import { Banknote } from 'lucide-react'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { PROMPT_PRIORITY, useRegisterPrompts, type Prompt } from '@/lib/store/usePromptStore'
import { useT } from '@/lib/i18n'
import { useActionToast } from '@/components/ui/ActionToast'
import { ATM_CATEGORY, answerCashLog, cashLogAnswer } from '@/lib/spending/cashLog'

/** Asked once, at the first bank-message cash withdrawal. Unanswered keeps withdrawals out of spending. */
export function CashLogPrompt() {
  const t = useT()
  const toast = useActionToast()
  const asked = useFinanceStore(
    (s) => cashLogAnswer(s.settings.promptState) === null && s.expenses.some((e) => e.category === ATM_CATEGORY && e.smsLogId),
  )
  const prompts: Prompt[] = asked
    ? [
        {
          key: 'cashLog',
          priority: PROMPT_PRIORITY.sms,
          tone: 'brand',
          icon: Banknote,
          title: t.prompts.cashLogTitle,
          description: t.prompts.cashLogBody,
          actions: [
            { label: t.prompts.cashLogYes, variant: 'default', onPress: () => answerCashLog('yes') },
            {
              label: t.prompts.cashLogNo,
              variant: 'secondary',
              onPress: () => {
                answerCashLog('no')
                toast(t.prompts.cashLogCounted)
              },
            },
          ],
        },
      ]
    : []
  useRegisterPrompts('cashLog', prompts)
  return null
}
