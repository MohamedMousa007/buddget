'use client'

import type { LucideIcon } from 'lucide-react'
import { Plus, X, Receipt, DollarSign, CreditCard, FileText, Sparkles, Mic, Camera } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ModalShell } from '@/components/modals/ModalShell'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { useEscapeClose } from '@/hooks/useEscapeClose'
import { useRequireAuthAction } from '@/hooks/useRequireAuthAction'
import { useT } from '@/lib/i18n'
import { useLongPress } from '@/hooks/useLongPress'
import { VoiceRecordSheet } from '@/components/voice/VoiceRecordSheet'
import { ReceiptScanSheet } from '@/components/receipt/ReceiptScanSheet'

type QuickAddOption = {
  id: string
  label: string
  icon: LucideIcon
}

export function QuickAddFAB() {
  const router = useRouter()
  const { activeModal, setActiveModal, openDebtSheetNew } = useSettingsStore()
  const requireAuth = useRequireAuthAction()
  const t = useT()
  const isOpen = activeModal === 'quickAdd'
  const voiceOpen = activeModal === 'voiceExpense'
  const scanOpen = activeModal === 'scanReceipt'

  const options: QuickAddOption[] = [
    { id: 'voiceExpense', label: t.modals.fabVoiceExpense, icon: Mic },
    { id: 'scanReceipt', label: t.modals.fabScanReceipt, icon: Camera },
    { id: 'addExpense', label: t.modals.fabLogPurchase, icon: Receipt },
    { id: 'addIncome', label: t.modals.fabAddIncome, icon: DollarSign },
    { id: 'addPaymentMethod', label: t.modals.fabAddPayment, icon: CreditCard },
    { id: 'addDebt', label: t.modals.fabTrackDebt, icon: FileText },
    { id: 'budgetSetup', label: t.modals.fabAskAi, icon: Sparkles },
  ]

  const openVoice = () => {
    requireAuth(() => {
      setActiveModal('voiceExpense')
    }, t.modals.fabRequireAuth)
  }

  const openScan = () => {
    requireAuth(() => {
      setActiveModal('scanReceipt')
    }, t.modals.fabRequireAuth)
  }

  const runOption = (optionId: string) => {
    const msg = t.modals.fabRequireAuth
    if (optionId === 'voiceExpense') {
      openVoice()
      return
    }
    if (optionId === 'scanReceipt') {
      openScan()
      return
    }
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

  const longPress = useLongPress<HTMLButtonElement>(
    openVoice,
    () => setActiveModal(isOpen ? null : 'quickAdd'),
    { delay: 600 },
  )

  return (
    <>
      <button
        type="button"
        data-tutorial-id="fab-root"
        {...longPress}
        className="hidden lg:flex fixed bottom-8 end-8 z-50 items-center justify-center w-14 h-14 rounded-full bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white shadow-lg shadow-red-900/30 transition-all duration-200 active:scale-95 cursor-pointer touch-none select-none"
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
        <h3 className="text-lg font-semibold text-[var(--color-brand-text-primary)] mb-4 pe-2">
          {t.modals.fabTitle}
        </h3>
        <p className="text-xs text-[var(--color-brand-text-muted)] mb-3 pe-2">
          {t.modals.fabLongPressTip}
        </p>
        <div className="space-y-1">
          {options.map((option) => {
            const Icon = option.icon
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => runOption(option.id)}
                className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm text-[var(--color-brand-text-primary)] hover:bg-[var(--color-brand-elevated)] transition-colors text-start"
              >
                <Icon className="h-5 w-5 shrink-0 text-[var(--color-brand-text-secondary)]" aria-hidden />
                <span>{option.label}</span>
              </button>
            )
          })}
        </div>
      </ModalShell>

      <VoiceRecordSheet open={voiceOpen} onClose={() => setActiveModal(null)} />
      <ReceiptScanSheet open={scanOpen} onClose={() => setActiveModal(null)} />
    </>
  )
}
