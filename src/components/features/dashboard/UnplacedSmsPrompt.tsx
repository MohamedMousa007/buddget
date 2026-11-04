'use client'
import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Landmark } from 'lucide-react'
import { unplacedSmsExpenses } from '@/lib/accounts/unplacedSms'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { PROMPT_PRIORITY, useRegisterPrompts, type Prompt } from '@/lib/store/usePromptStore'
import { useT } from '@/lib/i18n'

/**
 * Bank messages the app imported but could not place on an account never reach a balance, and nothing else tells the user.
 * Registers one prompt in the shared stack that opens the Accounts page, where the review sheet places them.
 */
export function UnplacedSmsPrompt() {
  const t = useT()
  const router = useRouter()
  const expenses = useFinanceStore((s) => s.expenses)
  const count = useMemo(() => unplacedSmsExpenses(expenses).length, [expenses])
  const prompts: Prompt[] = count === 0 ? [] : [{
    key: 'unplaced-sms',
    priority: PROMPT_PRIORITY.account,
    tone: 'warning',
    icon: Landmark,
    title: t.accountsPage.unplacedTitle(count),
    description: t.accountsPage.unplacedSub,
    actions: [{ label: t.prompts.review, variant: 'default', onPress: () => router.push('/accounts') }],
  }]
  useRegisterPrompts('unplaced-sms', prompts)
  return null
}
