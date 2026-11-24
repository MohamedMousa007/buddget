'use client'

import { useMemo } from 'react'
import { Copy } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { PROMPT_PRIORITY, useRegisterPrompts, type Prompt } from '@/lib/store/usePromptStore'
import { useActionToast } from '@/components/ui/ActionToast'
import { useShortDate } from '@/hooks/useShortDate'
import { useT } from '@/lib/i18n'
import { formatFlex } from '@/lib/utils/formatters'
import { methodDisplayName } from '@/lib/payment/paymentMethodDefaults'
import { confirmPrincipalDuplicate, declinePrincipalDuplicate, pendingPrincipalDuplicates, principalDuplicateKey } from '@/lib/debts/principalDuplicate'

/**
 * Asks about a bank row that looks like the money a debt already moved through its principal leg (the message came
 * after the debt was added). Nothing changes until the user answers; "No" is remembered for that debt and row.
 */
export function PrincipalDuplicatePrompts() {
  const t = useT()
  const copy = t.prompts
  const shortDate = useShortDate()
  const toast = useActionToast()
  const s = useFinanceStore(
    useShallow((st) => ({
      debts: st.debts,
      expenses: st.expenses,
      incomeEvents: st.incomeEvents,
      incomeSources: st.incomeSources,
      paymentMethods: st.paymentMethods,
      monthStartDay: st.settings.monthStartDay,
      rates: st.exchangeRates,
      promptState: st.settings.promptState,
    })),
  )
  const pending = useMemo(() => pendingPrincipalDuplicates(s), [s])

  const prompts: Prompt[] = pending.map((dup) => {
    const { debt, match } = dup
    const amount = `${formatFlex(debt.principalAmount ?? 0)} ${debt.principalCurrency ?? debt.currency}`
    const person = debt.person?.trim() || debt.name
    const row = match.kind === 'expense' ? s.expenses.find((e) => e.id === match.id)?.description : s.incomeEvents.find((i) => i.id === match.id)?.name
    const account = s.paymentMethods.find((m) => m.id === debt.principalPaymentMethodId)
    return {
      key: principalDuplicateKey(debt.id, match.id),
      priority: PROMPT_PRIORITY.sms,
      tone: 'warning',
      icon: Copy,
      title: (debt.direction === 'they_owe' ? copy.principalDupLentTitle : copy.principalDupBorrowedTitle)(amount, person),
      description: copy.principalDupBody(`${row ?? ''} · ${shortDate(match.date)}`.replace(/^ · /, ''), account ? methodDisplayName(account, t.accountsPage.typeCash) : ''),
      actions: [
        {
          label: copy.principalDupYes,
          variant: 'default',
          onPress: () => {
            const undo = confirmPrincipalDuplicate(dup)
            toast(copy.principalDupDone, { undo, undoLabel: t.common.undo })
          },
        },
        { label: copy.principalDupNo, variant: 'secondary', onPress: () => declinePrincipalDuplicate(dup) },
      ],
    }
  })
  useRegisterPrompts('principalDuplicate', prompts)
  return null
}
