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
const EDGE_GAP = 12 // gap from the viewport edge (matches the orb inset)
const ORB_SIZE = 44
const FAB_CLEAR = 96 // keep the bottom-right QuickAdd FAB uncovered on the right side

/** Desktop panel geometry, anchored to the orb and clamped into the viewport. */
interface DesktopPanel {
  side: 'left' | 'right'
  top: number
  height: number
  /** Vertical transform-origin (px from the panel top) — animates open from the orb. */
  originY: number
}

function computeDesktopPanel(orb: BuddgyOrbPosition): DesktopPanel | null {
  if (typeof window === 'undefined' || window.innerWidth < DESKTOP_BP) return null
  const vh = window.innerHeight
  const height = Math.min(PANEL_H, vh - EDGE_GAP * 2)
  const orbCenter = orb.top + ORB_SIZE / 2
  // On the right the panel must clear the bottom-right FAB; on the left a plain edge gap is enough.
  const bottomClear = orb.side === 'right' ? FAB_CLEAR : EDGE_GAP
  const maxTop = vh - height - bottomClear
  const top = Math.max(EDGE_GAP, Math.min(maxTop, orbCenter - height / 2))
  const originY = Math.max(0, Math.min(height, orbCenter - top))
  return { side: orb.side, top, height, originY }
}

/**
 * Full-screen (mobile) / floating (desktop) Buddget AI assistant. On desktop the
 * panel opens anchored to the draggable Buddgy orb's current edge position rather
 * than a fixed corner, so it never lands on the QuickAdd FAB. Logic lives in `useAIChat`.
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
  const [panel, setPanel] = useState<DesktopPanel | null>(() => computeDesktopPanel(orb))

  useEffect(() => {
    const recompute = () => setPanel(computeDesktopPanel(orb))
    recompute()
    window.addEventListener('resize', recompute)
    return () => window.removeEventListener('resize', recompute)
  }, [orb])

  const isDesktop = panel != null

  const panelClass = isDesktop
    ? 'fixed z-50 flex flex-col overflow-hidden bg-[var(--color-brand-card)] rounded-2xl border border-[var(--color-brand-border)] shadow-[0_24px_60px_-15px_rgba(0,0,0,0.7)]'
    : 'fixed bottom-0 start-0 end-0 z-50 flex flex-col max-h-[80vh] bg-[var(--color-brand-card)] rounded-t-[26px] border-t border-[var(--color-brand-border)] shadow-[0_-20px_50px_-20px_rgba(0,0,0,0.7)]'

  const panelStyle = isDesktop
    ? {
        top: panel.top,
        ...(panel.side === 'left' ? { left: EDGE_GAP } : { right: EDGE_GAP }),
        width: PANEL_W,
        height: panel.height,
        transformOrigin: `${panel.side} ${panel.originY}px`,
      }
    : undefined

  const motionProps = isDesktop
    ? {
        initial: { opacity: 0, scale: 0.92 },
        animate: { opacity: 1, scale: 1 },
        exit: { opacity: 0, scale: 0.92 },
        transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] as const },
      }
    : {
        initial: { y: '110%' },
        animate: { y: 0 },
        exit: { y: '110%' },
        transition: { duration: 0.26, ease: [0.22, 1, 0.36, 1] as const },
      }

  return (
    <AnimatePresence>
      {isOpen && (
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
            style={panelStyle}
            {...motionProps}
            className={panelClass}
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
