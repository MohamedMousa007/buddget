'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAIChat } from '@/hooks/useAIChat'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { AIChatHeader } from '@/components/features/ai-chat/AIChatHeader'
import { AIChatEmptyState } from '@/components/features/ai-chat/AIChatEmptyState'
import { AIChatMessageList } from '@/components/features/ai-chat/AIChatMessageList'
import { AIChatTypingIndicator } from '@/components/features/ai-chat/AIChatTypingIndicator'
import { AIChatComposer } from '@/components/features/ai-chat/AIChatComposer'
import type { BuddgyOrbPosition } from '@/lib/store/useSettingsStore'

const DESKTOP_BP = 1024
const PANEL_W = 400
const PANEL_H = 600
const EDGE_GAP = 12 // gap from the viewport / safe-area edge (matches the orb inset)
const ORB_SIZE = 44
const FAB_CLEAR = 96 // desktop: keep the bottom-right QuickAdd FAB uncovered
const NAV_CLEAR = 76 // mobile: keep the bottom tab bar uncovered
const HEADER_CLEAR = 52 // mobile: keep the fixed top header uncovered

/** Panel geometry, anchored to the orb and clamped inside the safe area. */
interface PanelGeometry {
  side: 'left' | 'right'
  top: number
  width: number
  height: number
  /** Horizontal inset from the orb's edge (incl. safe-area). */
  sideInset: number
  /** Vertical transform-origin (px from the panel top) — animates open from the orb. */
  originY: number
}

/** Resolved safe-area insets in px (mirrored from CSS env via custom props). */
function safeAreaInsets(): { top: number; bottom: number; left: number; right: number } {
  if (typeof window === 'undefined') return { top: 0, bottom: 0, left: 0, right: 0 }
  const cs = getComputedStyle(document.documentElement)
  const px = (v: string) => parseFloat(cs.getPropertyValue(v)) || 0
  return {
    top: px('--sai-top'),
    bottom: px('--sai-bottom'),
    left: px('--sai-left'),
    right: px('--sai-right'),
  }
}

function computePanel(orb: BuddgyOrbPosition): PanelGeometry | null {
  if (typeof window === 'undefined') return null
  const vw = window.innerWidth
  const vh = window.innerHeight
  const ins = safeAreaInsets()
  const desktop = vw >= DESKTOP_BP

  const width = desktop
    ? PANEL_W
    : Math.min(PANEL_W, vw - ins.left - ins.right - EDGE_GAP * 2)
  const availH = vh - ins.top - ins.bottom - EDGE_GAP * 2
  const height = Math.min(desktop ? PANEL_H : Math.round(vh * 0.82), PANEL_H, availH)

  // The bottom nav (mobile) / floating FAB (desktop, right side only) must stay clear.
  const bottomClear = desktop ? (orb.side === 'right' ? FAB_CLEAR : EDGE_GAP) : NAV_CLEAR
  const topClear = desktop ? EDGE_GAP : HEADER_CLEAR + EDGE_GAP

  const orbCenter = orb.top + ORB_SIZE / 2
  const minTop = ins.top + topClear
  const maxTop = Math.max(minTop, vh - ins.bottom - height - bottomClear)
  const top = Math.max(minTop, Math.min(maxTop, orbCenter - height / 2))
  const originY = Math.max(0, Math.min(height, orbCenter - top))
  const sideInset = (orb.side === 'left' ? ins.left : ins.right) + EDGE_GAP

  return { side: orb.side, top, width, height, sideInset, originY }
}

/**
 * Buddget AI assistant panel. Opens anchored to the draggable Buddgy orb's
 * current edge position — on every platform — so it emerges from the icon and
 * never lands on the QuickAdd FAB (desktop) or bottom tab bar (mobile). Stays
 * inside the safe area. Logic lives in `useAIChat`.
 */
export function AIChat() {
  const {
    isOpen,
    close,
    messages,
    input,
    setInput,
    isLoading,
    handleSend,
    handleConfirm,
    handleEdit,
    messagesEndRef,
    lastUserContentBefore,
    baseCurrency,
  } = useAIChat()

  const orb = useSettingsStore((s) => s.buddgyOrb)
  const [panel, setPanel] = useState<PanelGeometry | null>(() => computePanel(orb))

  useEffect(() => {
    const recompute = () => setPanel(computePanel(orb))
    recompute()
    window.addEventListener('resize', recompute)
    return () => window.removeEventListener('resize', recompute)
  }, [orb])

  return (
    <AnimatePresence>
      {isOpen && panel && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            aria-hidden
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ai-chat-title"
            style={{
              top: panel.top,
              ...(panel.side === 'left' ? { left: panel.sideInset } : { right: panel.sideInset }),
              width: panel.width,
              height: panel.height,
              transformOrigin: `${panel.side} ${panel.originY}px`,
            }}
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="fixed z-50 flex flex-col overflow-hidden bg-[var(--color-brand-card)] rounded-[22px] border border-[var(--color-brand-border)] shadow-[0_24px_60px_-15px_rgba(0,0,0,0.7)]"
          >
            <AIChatHeader onClose={close} />

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <AIChatEmptyState onPickSuggestion={setInput} />
              ) : (
                <AIChatMessageList
                  messages={messages}
                  baseCurrency={baseCurrency}
                  lastUserContentBefore={lastUserContentBefore}
                  onConfirm={handleConfirm}
                  onEdit={handleEdit}
                  scrollAnchorRef={messagesEndRef}
                />
              )}

              {isLoading ? <AIChatTypingIndicator /> : null}
            </div>

            <AIChatComposer
              value={input}
              onChange={setInput}
              onSend={() => void handleSend()}
              disabled={isLoading}
            />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
