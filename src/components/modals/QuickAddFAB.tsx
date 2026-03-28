'use client'

import { Plus, X, Receipt, DollarSign, CreditCard, FileText, Bot } from 'lucide-react'
import { motion } from 'framer-motion'
import { ModalShell } from '@/components/modals/ModalShell'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { useEscapeClose } from '@/hooks/useEscapeClose'
import { useRequireAuthAction } from '@/hooks/useRequireAuthAction'

const OPTIONS = [
  { id: 'addExpense', label: 'Add Expense', icon: Receipt, emoji: '💸' },
  { id: 'addIncome', label: 'Add Income Source', icon: DollarSign, emoji: '💵' },
  { id: 'addPaymentMethod', label: 'Add Payment Method', icon: CreditCard, emoji: '💳' },
  { id: 'addDebt', label: 'Add / Pay a Debt', icon: FileText, emoji: '📋' },
  { id: 'aiChat', label: 'Ask AI Assistant', icon: Bot, emoji: '🤖' },
]

export function QuickAddFAB() {
  const { activeModal, setActiveModal, openDebtSheetNew } = useSettingsStore()
  const requireAuth = useRequireAuthAction()
  const isOpen = activeModal === 'quickAdd'

  const runOption = (optionId: string) => {
    const msg =
      'Sign in or create an account to add data and sync it securely across devices.'
    if (optionId === 'addDebt') {
      requireAuth(() => {
        setActiveModal(null)
        openDebtSheetNew()
      }, msg)
      return
    }
    if (optionId === 'aiChat') {
      requireAuth(() => {
        setActiveModal(null)
        setActiveModal('aiChat')
      }, 'Sign in or create an account to use Buddget AI.')
      return
    }
    requireAuth(() => {
      setActiveModal(null)
      setActiveModal(optionId)
    }, msg)
  }

  useEscapeClose(isOpen, () => setActiveModal(null))

  return (
    <>
      {/* Desktop FAB */}
      <button
        onClick={() => setActiveModal(isOpen ? null : 'quickAdd')}
        className="hidden lg:flex fixed bottom-8 right-8 z-50 items-center justify-center w-14 h-14 rounded-full bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white shadow-lg shadow-red-900/30 transition-all duration-200 active:scale-95"
      >
        <motion.div
          animate={{ rotate: isOpen ? 45 : 0 }}
          transition={{ duration: 0.2 }}
        >
          {isOpen ? <X className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
        </motion.div>
      </button>

      <ModalShell
        open={isOpen}
        onBackdropClick={() => setActiveModal(null)}
        dragToClose
        panelClassName="!bottom-[max(0.5rem,calc(4rem+env(safe-area-inset-bottom,0px)))] !left-2 !right-2 !max-h-[min(72vh,calc(100dvh-5.5rem))] lg:!bottom-24 lg:!right-8 lg:!left-auto lg:!top-auto lg:!translate-x-0 lg:!translate-y-0 lg:!w-[360px] lg:!max-h-[min(90vh,520px)] lg:!rounded-2xl"
      >
        <h3 className="text-lg font-semibold text-white mb-4 pr-2">What would you like to add?</h3>
        <div className="space-y-1">
          {OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => runOption(option.id)}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm text-white hover:bg-[var(--color-brand-elevated)] transition-colors text-left"
            >
              <span className="text-lg shrink-0">{option.emoji}</span>
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      </ModalShell>
    </>
  )
}
