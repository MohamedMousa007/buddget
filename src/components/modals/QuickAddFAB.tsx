'use client'

import { Plus, X, Receipt, DollarSign, CreditCard, FileText, Sparkles } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ModalShell } from '@/components/modals/ModalShell'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { useEscapeClose } from '@/hooks/useEscapeClose'
import { useRequireAuthAction } from '@/hooks/useRequireAuthAction'
import { useT } from '@/lib/i18n'

export function QuickAddFAB() {
  const router = useRouter()
  const { activeModal, setActiveModal, openDebtSheetNew } = useSettingsStore()
  const requireAuth = useRequireAuthAction()
  const t = useT()
  const isOpen = activeModal === 'quickAdd'

  const OPTIONS = [
    { id: 'addExpense', label: t.modals.fabLogPurchase, icon: Receipt, emoji: '💸' },
    { id: 'addIncome', label: t.modals.fabAddIncome, icon: DollarSign, emoji: '💵' },
    { id: 'addPaymentMethod', label: t.modals.fabAddPayment, icon: CreditCard, emoji: '💳' },
    { id: 'addDebt', label: t.modals.fabTrackDebt, icon: FileText, emoji: '📋' },
    { id: 'budgetSetup', label: t.modals.fabAskAi, icon: Sparkles, emoji: '✨' },
  ]

  const runOption = (optionId: string) => {
    const msg = t.modals.fabRequireAuth
    if (optionId === 'addDebt') {
      requireAuth(() => {
        setActiveModal(null)
        openDebtSheetNew()
      }, msg)
      return
    }
    if (optionId === 'budgetSetup') {
      requireAuth(() => {
        setActiveModal(null)
        router.push('/budget-setup')
      }, t.modals.fabRequireAuthAi)
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
        type="button"
        onClick={() => setActiveModal(isOpen ? null : 'quickAdd')}
        className="hidden lg:flex fixed bottom-8 end-8 z-50 items-center justify-center w-14 h-14 rounded-full bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white shadow-lg shadow-red-900/30 transition-all duration-200 active:scale-95 cursor-pointer"
        aria-label={isOpen ? t.common.close : t.nav.quickAdd}
        aria-expanded={isOpen}
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
        panelClassName="!bottom-[max(0.5rem,calc(4rem+env(safe-area-inset-bottom,0px)))] !start-2 !end-2 !max-h-[min(72vh,calc(100dvh-5.5rem))] lg:!bottom-24 lg:!end-8 lg:!start-auto lg:!top-auto lg:!translate-x-0 lg:!translate-y-0 lg:!w-[360px] lg:!max-h-[min(90vh,520px)] lg:!rounded-2xl"
      >
        <h3 className="text-lg font-semibold text-[var(--color-brand-text-primary)] mb-4 pe-2">{t.modals.fabTitle}</h3>
        <div className="space-y-1">
          {OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => runOption(option.id)}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm text-[var(--color-brand-text-primary)] hover:bg-[var(--color-brand-elevated)] transition-colors text-start"
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
