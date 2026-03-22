'use client'

import { AddExpenseSheet } from './AddExpenseSheet'
import { AddIncomeSheet } from './AddIncomeSheet'
import { EditIncomeSheet } from './EditIncomeSheet'
import { AddDebtSheet } from './AddDebtSheet'
import { AddRecurringDebtPaymentSheet } from './AddRecurringDebtPaymentSheet'
import { AddPaymentMethodSheet } from './AddPaymentMethodSheet'
import { EditExpenseSheet } from './EditExpenseSheet'
import { EditDebtSheet } from './EditDebtSheet'
import { AIChat } from '@/components/ai/AIChat'
import { AIChatBubble } from '@/components/ai/AIChatBubble'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { useRequireAuthAction } from '@/lib/hooks/useRequireAuthAction'
import { useRecurringDebtPaymentScheduler } from '@/lib/hooks/useRecurringDebtPaymentScheduler'

export function ModalProvider() {
  const { setActiveModal } = useSettingsStore()
  const requireAuth = useRequireAuthAction()
  useRecurringDebtPaymentScheduler()

  return (
    <>
      <AddExpenseSheet />
      <AddIncomeSheet />
      <EditIncomeSheet />
      <AddDebtSheet />
      <AddRecurringDebtPaymentSheet />
      <AddPaymentMethodSheet />
      <EditExpenseSheet />
      <EditDebtSheet />
      <AIChat />
      <AIChatBubble
        onClick={() =>
          requireAuth(
            () => setActiveModal('aiChat'),
            'Sign in or create an account to use Buddget AI.'
          )
        }
      />
    </>
  )
}
