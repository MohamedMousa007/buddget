'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { WifiOff } from 'lucide-react'
import { useBuddgyChat } from '@/hooks/useBuddgyChat'
import { useBuddgyChatCopy } from '@/lib/i18n/buddgyChatCopy'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { useScrollLock } from '@/lib/ui/scrollLock'
import { AIChatHeader } from '@/components/features/ai-chat/AIChatHeader'
import { AIChatEmptyState } from '@/components/features/ai-chat/AIChatEmptyState'
import { AIChatMessageList } from '@/components/features/ai-chat/AIChatMessageList'
import { AIChatComposer } from '@/components/features/ai-chat/AIChatComposer'
import { useChatVoice } from '@/hooks/useChatVoice'
import { NoticeBanners } from '@/components/features/usage/NoticeHost'
import { useDismissable } from '@/hooks/useDismissable'
import { useDialogFocus } from '@/hooks/useDialogFocus'
import { computePanel, readViewport, safeAreaInsets, type PanelGeometry } from '@/components/features/ai-chat/panelGeometry'

/**
 * Buddgy assistant panel. Opens anchored to the draggable Buddgy orb's
 * current edge position — on every platform — so it emerges from the icon and
 * never lands on the QuickAdd FAB (desktop) or bottom tab bar (mobile). Stays
 * inside the safe area. Logic lives in `useAIChat`.
 */
export function AIChat() {
  const {
    isOpen, close, items, input, setInput, busy, step, beat, online, bottomRef, newChat, send, stop, retry, keepGoing,
    applyProposal, dismissProposal, reviseProposal, undoApplied,
  } = useBuddgyChat()
  const copy = useBuddgyChatCopy()
  const chatVoice = useChatVoice((text) => void send(text, { voice: true }))
  const orb = useSettingsStore((s) => s.buddgyOrb)
  const [panel, setPanel] = useState<PanelGeometry | null>(() => {
    const view = readViewport()
    return view && computePanel(orb, view, safeAreaInsets())
  })

  // BDG-014: iOS fires no window resize for the keyboard; the visual viewport and focus changes say when it comes and goes.
  useEffect(() => {
    const recompute = () => {
      const view = readViewport()
      if (view) setPanel(computePanel(orb, view, safeAreaInsets()))
    }
    recompute()
    const vv = window.visualViewport
    window.addEventListener('resize', recompute)
    vv?.addEventListener('resize', recompute)
    vv?.addEventListener('scroll', recompute)
    document.addEventListener('focusin', recompute)
    document.addEventListener('focusout', recompute)
    return () => {
      window.removeEventListener('resize', recompute)
      vv?.removeEventListener('resize', recompute)
      vv?.removeEventListener('scroll', recompute)
      document.removeEventListener('focusin', recompute)
      document.removeEventListener('focusout', recompute)
    }
  }, [orb])

  useScrollLock(isOpen)
  // Android back / Escape close the chat instead of the whole screen.
  useDismissable(isOpen, close)
  const panelRef = useRef<HTMLDivElement>(null)
  useDialogFocus(isOpen && !!panel, panelRef, true)

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
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ai-chat-title"
            style={{
              top: panel.top,
              ...(panel.side === 'left' ? { left: panel.sideInset } : { right: panel.sideInset }),
              width: panel.width,
              height: panel.height,
              transformOrigin: `${panel.side === 'left' ? `${panel.originX}px` : `calc(100% - ${panel.originX}px)`} ${panel.originY}px`,
            }}
            initial={{ opacity: 0, scale: 0.08, borderRadius: 48 }}
            animate={{ opacity: 1, scale: 1, borderRadius: 16 }}
            exit={{ opacity: 0, scale: 0.08, borderRadius: 48 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32, opacity: { duration: 0.14 } }}
            className="fixed z-50 flex flex-col overflow-hidden outline-none bg-[var(--color-brand-card)] rounded-2xl border border-[var(--color-brand-border)] shadow-[0_24px_60px_-15px_rgba(0,0,0,0.7)]"
          >
            <AIChatHeader onClose={close} onNewChat={newChat} canReset={items.length > 0} beat={beat} isLoading={busy} streaming={busy && items.at(-1)?.role === 'buddgy' && (items.at(-1)?.text ?? '') !== ''} />

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {items.length === 0 ? (
                <AIChatEmptyState onPickSuggestion={(prompt) => void send(prompt)} />
              ) : (
                <AIChatMessageList
                  items={items}
                  step={step}
                  onApply={applyProposal}
                  onDismiss={dismissProposal}
                  onRevise={reviseProposal}
                  onUndo={undoApplied}
                  onRetry={retry}
                  onContinue={keepGoing}
                  onNewChat={newChat}
                />
              )}
              <div ref={bottomRef} />
            </div>

            {!online && (
              <div className="flex items-center gap-2 border-t border-[var(--color-brand-border)] px-4 py-2.5 text-xs text-[var(--color-brand-text-muted)]">
                <WifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {copy.offline}
              </div>
            )}

            <NoticeBanners screen="chat" className="flex flex-col gap-2 px-3 pb-2" />

            <AIChatComposer
              value={input}
              onChange={setInput}
              onSend={() => void send()}
              onStop={stop}
              busy={busy}
              usageKey={`${busy}:${items.length === 0}`}
              mic={{ state: chatVoice.state, error: chatVoice.error, onStart: () => void chatVoice.start(), onStop: () => void chatVoice.stop() }}
            />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
