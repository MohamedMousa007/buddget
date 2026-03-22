'use client'

import { AddExpenseSheet } from './AddExpenseSheet'
import { AddIncomeSheet } from './AddIncomeSheet'
import { EditIncomeSheet } from './EditIncomeSheet'
import { AddDebtSheet } from './AddDebtSheet'
import { AddPaymentMethodSheet } from './AddPaymentMethodSheet'
import { EditExpenseSheet } from './EditExpenseSheet'
import { EditDebtSheet } from './EditDebtSheet'
import { AIChat } from '@/components/ai/AIChat'
import { AIChatBubble } from '@/components/ai/AIChatBubble'
import { useSettingsStore } from '@/lib/store/useSettingsStore'

export function ModalProvider() {
  const { setActiveModal } = useSettingsStore()

  return (
    <>
      <AddExpenseSheet />
      <AddIncomeSheet />
      <EditIncomeSheet />
      <AddDebtSheet />
      <AddPaymentMethodSheet />
      <EditExpenseSheet />
      <EditDebtSheet />
      <AIChat />
      <AIChatBubble onClick={() => setActiveModal('aiChat')} />
    </>
  )
}
