'use client'

import { useEffect } from 'react'
import dynamic from 'next/dynamic'
import { AddExpenseSheet } from './AddExpenseSheet'
import { AddIncomeSheet } from './AddIncomeSheet'
import { EditExpenseSheet } from './EditExpenseSheet'
import { AIChatBubble } from '@/components/ai/AIChatBubble'
import { QuickAddFAB } from '@/components/modals/QuickAddFAB'
import { GoalCelebrationListener } from '@/components/features/goals/celebrate/GoalCelebrationListener'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { useT } from '@/lib/i18n'
import { useRequireAuthAction } from '@/hooks/useRequireAuthAction'
import { useRecurringSavingsScheduler } from '@/hooks/useRecurringSavingsScheduler'
import { useLogDueSubscriptions } from '@/hooks/useLogDueSubscriptions'
import { useActionToast } from '@/components/ui/ActionToast'

// While a chunk loads nothing renders (sheets mount closed); if it cannot load (offline, never cached) tell the user.
function SheetFallback({ error }: { error?: Error | null }) {
  const toast = useActionToast()
  const t = useT()
  useEffect(() => {
    if (error) toast(t.modals.sheetUnavailableOffline)
  }, [error, toast, t])
  return null
}

const SHEET_IMPORTERS = [
  () => import('./EditIncomeSheet'),
  () => import('./EditIncomeEventSheet'),
  () => import('./AmountReceivedSheet'),
  () => import('./AssignIncomeSheet'),
  () => import('./AddDebtSheet'),
  () => import('./AddRecurringDebtPaymentSheet'),
  () => import('./AddCreditCardSheet'),
  () => import('./PaymentMethodsSheet'),
  () => import('./LifestyleSheet'),
  () => import('./HouseholdRentSheet'),
  () => import('@/components/features/ai-chat/AIChat'),
]

// Warm the service-worker cache while online so these sheets also open on a cold offline launch.
function usePrefetchSheets() {
  useEffect(() => {
    const run = () => {
      for (const load of SHEET_IMPORTERS) load().catch(() => {})
    }
    if (typeof requestIdleCallback === 'function') {
      const id = requestIdleCallback(run, { timeout: 5000 })
      return () => cancelIdleCallback(id)
    }
    const id = setTimeout(run, 2000)
    return () => clearTimeout(id)
  }, [])
}

// Sheets that are not offline capture paths load as separate chunks right after mount.
const EditIncomeSheet = dynamic(() => import('./EditIncomeSheet').then((m) => m.EditIncomeSheet), { ssr: false, loading: SheetFallback })
const EditIncomeEventSheet = dynamic(() => import('./EditIncomeEventSheet').then((m) => m.EditIncomeEventSheet), { ssr: false, loading: SheetFallback })
const AmountReceivedSheet = dynamic(() => import('./AmountReceivedSheet').then((m) => m.AmountReceivedSheet), { ssr: false, loading: SheetFallback })
const GlobalAssignIncomeSheet = dynamic(() => import('./AssignIncomeSheet').then((m) => m.GlobalAssignIncomeSheet), { ssr: false, loading: SheetFallback })
const AddDebtSheet = dynamic(() => import('./AddDebtSheet').then((m) => m.AddDebtSheet), { ssr: false, loading: SheetFallback })
const AddRecurringDebtPaymentSheet = dynamic(() => import('./AddRecurringDebtPaymentSheet').then((m) => m.AddRecurringDebtPaymentSheet), { ssr: false, loading: SheetFallback })
const AddCreditCardSheet = dynamic(() => import('./AddCreditCardSheet').then((m) => m.AddCreditCardSheet), { ssr: false, loading: SheetFallback })
const PaymentMethodsSheet = dynamic(() => import('./PaymentMethodsSheet').then((m) => m.PaymentMethodsSheet), { ssr: false, loading: SheetFallback })
const LifestyleSheet = dynamic(() => import('./LifestyleSheet').then((m) => m.LifestyleSheet), { ssr: false, loading: SheetFallback })
const HouseholdRentSheet = dynamic(() => import('./HouseholdRentSheet').then((m) => m.HouseholdRentSheet), { ssr: false, loading: SheetFallback })
const AIChat = dynamic(() => import('@/components/features/ai-chat/AIChat').then((m) => m.AIChat), { ssr: false, loading: SheetFallback })

export function ModalProvider() {
  const { setActiveModal, openAiChatWithSeed } = useSettingsStore()
  const t = useT()
  const requireAuth = useRequireAuthAction()
  useRecurringSavingsScheduler()
  useLogDueSubscriptions()
  usePrefetchSheets()

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
