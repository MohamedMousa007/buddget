'use client'

import { AddExpenseSheet } from './AddExpenseSheet'
import { AddIncomeSheet } from './AddIncomeSheet'
import { EditIncomeSheet } from './EditIncomeSheet'
import { EditIncomeEventSheet } from './EditIncomeEventSheet'
import { AmountReceivedSheet } from './AmountReceivedSheet'
import { GlobalAssignIncomeSheet } from './AssignIncomeSheet'
import { AddDebtSheet } from './AddDebtSheet'
import { AddRecurringDebtPaymentSheet } from './AddRecurringDebtPaymentSheet'
import { AddCreditCardSheet } from './AddCreditCardSheet'
import { PaymentMethodsSheet } from './PaymentMethodsSheet'
import { LifestyleSheet } from './LifestyleSheet'
import { HouseholdRentSheet } from './HouseholdRentSheet'
import { EditExpenseSheet } from './EditExpenseSheet'
import { AIChat } from '@/components/features/ai-chat/AIChat'
import { AIChatBubble } from '@/components/ai/AIChatBubble'
import { QuickAddFAB } from '@/components/modals/QuickAddFAB'
import { GoalCelebrationListener } from '@/components/features/goals/celebrate/GoalCelebrationListener'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { useT } from '@/lib/i18n'
import { useRequireAuthAction } from '@/hooks/useRequireAuthAction'
import { useRecurringSavingsScheduler } from '@/hooks/useRecurringSavingsScheduler'

export function ModalProvider() {
  const { setActiveModal, openAiChatWithSeed } = useSettingsStore()
  const t = useT()
  const requireAuth = useRequireAuthAction()
  useRecurringSavingsScheduler()

  return (
    <>
      <AddExpenseSheet />
      <AddIncomeSheet />
      <EditIncomeSheet />
      <EditIncomeEventSheet />
      <AmountReceivedSheet />
      <GlobalAssignIncomeSheet />
      <AddDebtSheet />
      <AddRecurringDebtPaymentSheet />
      <AddCreditCardSheet />
      <PaymentMethodsSheet />
      <LifestyleSheet />
      <HouseholdRentSheet />
      <EditExpenseSheet />
      <AIChat />
      <QuickAddFAB />
      <GoalCelebrationListener />
      <AIChatBubble
        onOpen={(prompt) =>
          requireAuth(
            () => (prompt ? openAiChatWithSeed(prompt, true) : setActiveModal('aiChat')),
            t.modals.fabRequireAuthAi,
          )
        }
      />
    </>
  )
}
