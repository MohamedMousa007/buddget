'use client'

import type { LucideIcon } from 'lucide-react'
import { Plus, X, Receipt, DollarSign, CreditCard, Coins, Mic, Camera } from 'lucide-react'
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

type QuickAddTile = {
  id: string
  label: string
  icon: LucideIcon
  fg: string
  bg: string
}

export function QuickAddFAB() {
  const router = useRouter()
  const { activeModal, setActiveModal } = useSettingsStore()
  const requireAuth = useRequireAuthAction()
  const t = useT()
  const isOpen = activeModal === 'quickAdd'
  const voiceOpen = activeModal === 'voiceExpense'
  const scanOpen = activeModal === 'scanReceipt'

  const tiles: QuickAddTile[] = [
    { id: 'scanReceipt', label: t.modals.fabTileScan, icon: Camera, fg: '#4DA3FF', bg: 'rgba(77,163,255,.16)' },
    { id: 'addExpense', label: t.modals.fabTileExpense, icon: Receipt, fg: 'var(--color-brand-red)', bg: 'rgba(229,9,20,.14)' },
    { id: 'addIncome', label: t.modals.fabTileIncome, icon: DollarSign, fg: 'var(--color-brand-green)', bg: 'rgba(29,185,84,.14)' },
    { id: 'payDebt', label: t.modals.fabTileDebt, icon: CreditCard, fg: '#FF5C5C', bg: 'rgba(255,92,92,.14)' },
    { id: 'addGoal', label: t.modals.fabTileSaving, icon: Coins, fg: 'var(--color-brand-gold)', bg: 'rgba(245,200,66,.14)' },
  ]

  const openVoice = () => {
    requireAuth(() => {
      setActiveModal('voiceExpense')
    }, t.modals.fabRequireAuth)
  }

  const runTile = (tileId: string) => {
    const msg = t.modals.fabRequireAuth
    if (tileId === 'scanReceipt') {
      requireAuth(() => setActiveModal('scanReceipt'), msg)
      return
    }
    if (tileId === 'payDebt') {
      requireAuth(() => {
        setActiveModal(null)
        router.push('/debts')
      }, msg)
      return
    }
    requireAuth(() => {
      setActiveModal(null)
      setActiveModal(tileId)
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
        {...longPress}
        className="hidden lg:flex fixed bottom-8 end-8 z-50 items-center justify-center w-14 h-14 rounded-full bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white shadow-lg shadow-red-900/30 transition-all duration-200 active:scale-95 cursor-pointer touch-none select-none"
        aria-label={isOpen ? t.common.close : t.nav.quickAdd}
        aria-expanded={isOpen}
      >
        <motion.div animate={{ rotate: isOpen ? 45 : 0 }} transition={{ duration: 0.2 }}>
          {isOpen ? <X className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
        </motion.div>
      </button>

      <ModalShell
        open={isOpen}
        onBackdropClick={() => setActiveModal(null)}
        dragToClose
        panelClassName="!bottom-0 !start-0 !end-0 !rounded-t-[26px] lg:!bottom-24 lg:!end-8 lg:!start-auto lg:!top-auto lg:!translate-x-0 lg:!translate-y-0 lg:!w-[360px] lg:!rounded-2xl"
      >
        <div className="mb-[14px] flex items-center justify-center gap-[7px] text-[11px] font-semibold text-[var(--color-brand-red)]">
          <Mic className="h-[13px] w-[13px] shrink-0" />
          {t.modals.fabVoiceTip}
        </div>
        <div className="grid grid-cols-5 gap-[6px]">
          {tiles.map((tile) => {
            const Icon = tile.icon
            return (
              <button
                key={tile.id}
                type="button"
                onClick={() => runTile(tile.id)}
                className="flex flex-col items-center gap-[7px] rounded-[13px] border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-[3px] py-[11px] text-center transition-colors hover:bg-[var(--color-brand-border)]/40"
              >
                <span
                  className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px]"
                  style={{ background: tile.bg, color: tile.fg }}
                >
                  <Icon className="h-[17px] w-[17px]" aria-hidden />
                </span>
                <span className="text-[10.5px] font-semibold leading-[1.15] text-[var(--color-brand-text-primary)]">
                  {tile.label}
                </span>
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
