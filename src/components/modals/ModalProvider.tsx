'use client'

import { AddExpenseSheet } from './AddExpenseSheet'
import { AddIncomeSheet } from './AddIncomeSheet'
import { EditIncomeSheet } from './EditIncomeSheet'
import { AddDebtSheet } from './AddDebtSheet'
import { AddRecurringDebtPaymentSheet } from './AddRecurringDebtPaymentSheet'
import { AddPaymentMethodSheet } from './AddPaymentMethodSheet'
import { AddGoalSheet } from './AddGoalSheet'
import { LifestyleSheet } from './LifestyleSheet'
import { HouseholdRentSheet } from './HouseholdRentSheet'
import { EditExpenseSheet } from './EditExpenseSheet'
import { EditDebtSheet } from './EditDebtSheet'
import { AIChat } from '@/components/features/ai-chat/AIChat'
import { AIChatBubble } from '@/components/ai/AIChatBubble'
import { QuickAddFAB } from '@/components/modals/QuickAddFAB'
import { GoalAchievementListener } from '@/components/features/goals/GoalAchievementListener'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { useT } from '@/lib/i18n'
import { useRequireAuthAction } from '@/hooks/useRequireAuthAction'
import { useRecurringDebtPaymentScheduler } from '@/hooks/useRecurringDebtPaymentScheduler'
import { useRecurringSavingsScheduler } from '@/hooks/useRecurringSavingsScheduler'

export function ModalProvider() {
  const { setActiveModal, activeModal } = useSettingsStore()
  const t = useT()
  const requireAuth = useRequireAuthAction()
  useRecurringDebtPaymentScheduler()
  useRecurringSavingsScheduler()

  return (
    <>
      <AddExpenseSheet />
      <AddIncomeSheet />
      <EditIncomeSheet />
      <AddDebtSheet />
      <AddRecurringDebtPaymentSheet />
      <AddPaymentMethodSheet />
      <AddGoalSheet
        open={activeModal === 'addGoal'}
        onClose={() => setActiveModal(null)}
        editingGoal={null}
      />
      <LifestyleSheet />
      <HouseholdRentSheet />
      <EditExpenseSheet />
      <EditDebtSheet />
      <AIChat />
      <QuickAddFAB />
      <GoalAchievementListener />
      <AIChatBubble
        onClick={() =>
          requireAuth(() => setActiveModal('aiChat'), t.modals.fabRequireAuthAi)
        }
      />
    </>
  )
}
