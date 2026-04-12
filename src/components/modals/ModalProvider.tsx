'use client'

import { AddExpenseSheet } from './AddExpenseSheet'
import { AddIncomeSheet } from './AddIncomeSheet'
import { EditIncomeSheet } from './EditIncomeSheet'
import { AddDebtSheet } from './AddDebtSheet'
import { AddRecurringDebtPaymentSheet } from './AddRecurringDebtPaymentSheet'
import { AddPaymentMethodSheet } from './AddPaymentMethodSheet'
import { EditExpenseSheet } from './EditExpenseSheet'
import { EditDebtSheet } from './EditDebtSheet'
import { AIChat } from '@/components/features/ai-chat/AIChat'
import { AIChatBubble } from '@/components/ai/AIChatBubble'
import { QuickAddFAB } from '@/components/modals/QuickAddFAB'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { useT } from '@/lib/i18n'
import { useRequireAuthAction } from '@/hooks/useRequireAuthAction'
import { useRecurringDebtPaymentScheduler } from '@/hooks/useRecurringDebtPaymentScheduler'
import { useAutoSaveScheduler } from '@/hooks/useAutoSaveScheduler'

export function ModalProvider() {
  const { setActiveModal } = useSettingsStore()
  const t = useT()
  const requireAuth = useRequireAuthAction()
  useRecurringDebtPaymentScheduler()
  useAutoSaveScheduler()

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
      <QuickAddFAB />
      <AIChatBubble
        onClick={() =>
          requireAuth(() => setActiveModal('aiChat'), t.modals.fabRequireAuthAi)
        }
      />
    </>
  )
}
