'use client'

import type { LucideIcon } from 'lucide-react'
import { Plus, X, Receipt, DollarSign, CreditCard, Coins, Mic, Camera } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ModalShell } from '@/components/modals/ModalShell'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { useEscapeClose } from '@/hooks/useEscapeClose'
import { useRequireAuthAction } from '@/hooks/useRequireAuthAction'
import { useRef } from 'react'
import { useT } from '@/lib/i18n'
import { useVoiceHoldGesture } from '@/hooks/useVoiceHoldGesture'
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

  const renderTile = (tile: QuickAddTile) => {
    const Icon = tile.icon
    return (
      <button
        key={tile.id}
        type="button"
        onClick={() => runTile(tile.id)}
        className="flex w-full flex-col items-center gap-[9px] rounded-[14px] border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-[5px] py-[14px] text-center transition-colors active:bg-[var(--color-brand-border)]/40"
      >
        <span
          className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-[12px]"
          style={{ background: tile.bg, color: tile.fg }}
        >
          <Icon className="h-[22px] w-[22px]" aria-hidden />
        </span>
        <span className="text-[12px] font-semibold leading-[1.2] text-[var(--color-brand-text-primary)]">
          {tile.label}
        </span>
      </button>
    )
  }

  useEscapeClose(isOpen, () => setActiveModal(null))

  // Desktop has no drag-to-trash zone; recording is managed inside VoiceRecordSheet.
  const trashRef = useRef<HTMLDivElement>(null)
  const { handlers } = useVoiceHoldGesture({
    trashRef,
    holdMs: 600,
    onTap: () => setActiveModal(isOpen ? null : 'quickAdd'),
    onHoldStart: openVoice,
    onHoldEnd: () => {},
    onHoldCancel: () => {},
  })

  return (
    <>
      <button
        type="button"
        {...handlers}
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
        <div className="flex flex-col gap-[6px]">
          <div className="grid grid-cols-3 gap-[6px]">
            {tiles.slice(0, 3).map(renderTile)}
          </div>
          <div className="flex justify-center gap-[6px]">
            {tiles.slice(3).map((tile) => (
              <div key={tile.id} style={{ width: 'calc((100% - 12px) / 3)' }}>
                {renderTile(tile)}
              </div>
            ))}
          </div>
        </div>
      </ModalShell>

      <VoiceRecordSheet open={voiceOpen} onClose={() => setActiveModal(null)} />
      <ReceiptScanSheet open={scanOpen} onClose={() => setActiveModal(null)} />
    </>
  )
}
