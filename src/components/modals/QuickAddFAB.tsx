'use client'

import type { LucideIcon } from 'lucide-react'
import { Plus, X, BanknoteArrowDown, BanknoteArrowUp, ScanLine, CreditCard, Coins, Mic, Wallet } from 'lucide-react'
import { motion } from 'framer-motion'
import { navigate } from '@/lib/navigation/navigate'
import { ModalShell } from '@/components/modals/ModalShell'
import { ModalTitle } from '@/components/modals/ModalTitle'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { useEscapeClose } from '@/hooks/useEscapeClose'
import { useRequireAuthAction } from '@/hooks/useRequireAuthAction'
import { useRef } from 'react'
import { useT } from '@/lib/i18n'
import { useVoiceHoldGesture } from '@/hooks/useVoiceHoldGesture'
import { VoiceRecordSheet } from '@/components/voice/VoiceRecordSheet'
import { ReceiptScanSheet } from '@/components/receipt/ReceiptScanSheet'
import { SelectableCard } from '@/components/ui/SelectableCard'
import { RotateCwClock } from '@/components/ui/icons/RotateCwClock'

type QuickAddTile = {
  id: string
  label: string
  hint: string
  icon: LucideIcon
  fg: string
  bg: string
}

/** A tile tint from a colour token: the token as the glyph, 15% of it as the chip. */
const tint = (token: string) => ({ fg: token, bg: `color-mix(in oklab, ${token} 15%, transparent)` })

export function QuickAddFAB() {
  const { activeModal, setActiveModal } = useSettingsStore()
  const requireAuth = useRequireAuthAction()
  const t = useT()
  const isOpen = activeModal === 'quickAdd'
  const voiceOpen = activeModal === 'voiceExpense'
  const scanOpen = activeModal === 'scanReceipt'

  // Under the "Add" title every tile is a noun, so each reads as "Add …".
  const tiles: QuickAddTile[] = [
    { id: 'addIncome', label: t.modals.fabTileIncome, hint: t.quickAdd.hintIncome, icon: BanknoteArrowDown, fg: 'var(--color-brand-green)', bg: 'var(--color-brand-green-soft)' },
    { id: 'addExpense', label: t.modals.fabTileExpense, hint: t.quickAdd.hintExpense, icon: BanknoteArrowUp, fg: 'var(--color-brand-primary-ink)', bg: 'var(--color-brand-primary-soft)' },
    { id: 'scanReceipt', label: t.modals.fabTileScan, hint: t.quickAdd.hintScan, icon: ScanLine, ...tint('var(--color-cat-4)') },
    { id: 'payDebt', label: t.modals.fabTileDebt, hint: t.quickAdd.hintDebt, icon: CreditCard, ...tint('var(--color-cat-5)') },
    { id: 'wealth', label: t.modals.fabTileWealth, hint: t.quickAdd.hintWealth, icon: Coins, ...tint('var(--color-brand-gold)') },
    { id: 'addSubscription', label: t.subscriptions.ui.quickAdd.subscription, hint: t.quickAdd.hintSubscription, icon: RotateCwClock, fg: 'var(--color-brand-primary-ink)', bg: 'var(--color-brand-primary-soft)' },
    { id: 'addPaymentMethod', label: t.modals.fabTileMethod, hint: t.quickAdd.hintMethod, icon: Wallet, ...tint('var(--color-cat-2)') },
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
      requireAuth(() => useSettingsStore.getState().openPayDebtSheet(), msg)
      return
    }
    if (tileId === 'addSubscription') {
      requireAuth(() => {
        setActiveModal(null)
        useSettingsStore.getState().setSubscriptionAddOpen(true)
        navigate('/subscriptions')
      }, msg)
      return
    }
    if (tileId === 'wealth') {
      requireAuth(() => {
        setActiveModal(null)
        navigate('/wealth')
      }, msg)
      return
    }
    requireAuth(() => {
      setActiveModal(null)
      setActiveModal(tileId)
    }, msg)
  }

  const renderTile = (tile: QuickAddTile, index: number) => {
    const Icon = tile.icon
    return (
      <div key={tile.id} className={tiles.length % 2 === 1 && index === tiles.length - 1 ? 'col-span-2 min-w-0' : 'min-w-0'}>
        <SelectableCard as="action" surface="elevated" layout="row" onClick={() => runTile(tile.id)} className="w-full min-w-0">
          <span className="flex w-full min-w-0 items-center gap-2.5 overflow-hidden text-start">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px]" style={{ background: tile.bg, color: tile.fg }}>
              <Icon className="size-[19px]" strokeWidth={1.75} aria-hidden />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-px">
              <span className="truncate text-sm font-bold leading-[1.25] text-[var(--color-brand-text-primary)]">{tile.label}</span>
              <span className="line-clamp-2 text-[0.71875rem] leading-[1.3] text-[var(--color-brand-text-secondary)]">{tile.hint}</span>
            </span>
          </span>
        </SelectableCard>
      </div>
    )
  }

  // "Tip:" leads the sentence in bold ink; the rest stays secondary.
  const tipCut = t.modals.fabVoiceTip.indexOf(':') + 1
  const tipLead = t.modals.fabVoiceTip.slice(0, tipCut)
  const tipRest = t.modals.fabVoiceTip.slice(tipCut)

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
      <button data-raw-button-ok="the floating action button itself, with its own press choreography"
        type="button"
        {...handlers}
        className={`hidden lg:flex fixed bottom-8 end-8 ${isOpen ? 'z-[110]' : 'z-50'} items-center justify-center h-[54px] w-[54px] rounded-[18px] bg-[var(--color-brand-primary)] hover:bg-[var(--color-brand-primary-hover)] text-[var(--color-brand-on-primary)] shadow-[0_8px_20px_-6px_color-mix(in_srgb,var(--color-brand-primary)_60%,transparent)] transition-all duration-200 active:scale-95 cursor-pointer touch-none select-none`}
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
        anchor="corner"
      >
        {/* Content-height, never scrolls; clears the home indicator. */}
        <div className="flex min-w-0 flex-col gap-3 px-4 pb-[max(env(safe-area-inset-bottom,0px),20px)]">
          <ModalTitle>{t.quickAdd.title}</ModalTitle>
          <div className="grid min-w-0 grid-cols-2 gap-2">{tiles.map(renderTile)}</div>
          {/* Plain centred text — not a button or a pill. */}
          <p className="mt-0.5 flex items-center justify-center gap-[7px] text-center text-[0.78125rem] leading-[1.4] text-[var(--color-brand-text-secondary)]">
            <Mic className="size-[15px] shrink-0 text-[var(--color-brand-primary-ink)]" strokeWidth={2} aria-hidden />
            <span className="min-w-0">
              <b className="font-bold text-[var(--color-brand-primary-ink)]">{tipLead}</b>
              {tipRest}
            </span>
          </p>
        </div>
      </ModalShell>

      <VoiceRecordSheet open={voiceOpen} onClose={() => setActiveModal(null)} />
      <ReceiptScanSheet open={scanOpen} onClose={() => setActiveModal(null)} />
    </>
  )
}
