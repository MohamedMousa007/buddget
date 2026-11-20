'use client'

import { useState, useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { checkAIStatus } from '@/lib/ai/gemini'
import { useOptionalAuth } from '@/components/auth/auth-context'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useT } from '@/lib/i18n'
import { BuddgyIcon, buddgyMoodColor, type BuddgyMood } from '@/components/ai/BuddgyIcon'
import { BuddgyNudgeWatcher } from '@/components/ai/BuddgyNudgeWatcher'
import { IconButton } from '@/components/ui/IconButton'
import { useBuddgyMood, buddgyStatusText } from '@/lib/ai/useBuddgyMood'
import { useBuddgyLife } from '@/hooks/useBuddgyLife'
import { NUDGE_RULES, type BuddgyNudge } from '@/lib/ai/buddgyIdeas'
import { ORB_INSET as EDGE_INSET, ORB_SIZE, dragLeft, readViewport, snapSide } from '@/components/features/ai-chat/panelGeometry'

interface AIChatBubbleProps {
  /** Opens the chat; with a prompt, sends it straight away (a tapped tip). */
  onOpen: (prompt?: string) => void
}

const TALK_MS = 1600
const SETTLE_MS = 240
const clampTop = (top: number) => Math.max(70, Math.min(window.innerHeight - 150, top))

/**
 * Buddgy himself, standing at the screen edge — the face is the button, not an
 * icon inside a circle. Drags vertically and snaps to the left/right edge; a tap
 * (no drag) opens the chat, which grows out of this spot.
 *
 * Face priority: a mood some surface owns (listening, scanning, offline…) beats
 * a tip being spoken, which beats Buddgy's own ambient life (see useBuddgyLife).
 */
export function AIChatBubble({ onOpen }: AIChatBubbleProps) {
  const t = useT()
  const [aiEnabled, setAiEnabled] = useState(false)
  const userAllowsAi = useFinanceStore((s) => s.settings.enableAI)
  const { orb, setBuddgyOrb, chatOpen, anyModal, nudgesOn } = useSettingsStore(
    useShallow((s) => ({
      orb: s.buddgyOrb,
      setBuddgyOrb: s.setBuddgyOrb,
      chatOpen: s.activeModal === 'aiChat',
      anyModal: s.activeModal !== null,
      nudgesOn: s.buddgyNudges,
    })),
  )
  const surfaceMood = useBuddgyMood()
  const btnRef = useRef<HTMLButtonElement>(null)
  const reactRef = useRef<HTMLSpanElement>(null)
  const life = useBuddgyLife(reactRef, orb.side, chatOpen)
  const [dragging, setDragging] = useState(false)
  /** While dragged, or gliding to its edge after release: where the orb is drawn. */
  const [drag, setDrag] = useState<{ left: number; top: number; settling?: boolean } | null>(null)
  const [nudge, setNudge] = useState<BuddgyNudge | null>(null)
  const [talking, setTalking] = useState(false)

  // Signed out the orb cannot open (it goes through requireAuth), so there is nothing to ask the server.
  const signedIn = Boolean(useOptionalAuth()?.user)
  useEffect(() => {
    if (!signedIn) return
    checkAIStatus().then((status) => setAiEnabled(status.enabled))
  }, [signedIn])

  // A tip talks for a beat, then holds its expression until it times out.
  useEffect(() => {
    if (!nudge) return
    life.react('jump')
    setTalking(true)
    const talk = window.setTimeout(() => setTalking(false), TALK_MS)
    const hide = window.setTimeout(() => setNudge(null), NUDGE_RULES.visibleMs)
    return () => {
      window.clearTimeout(talk)
      window.clearTimeout(hide)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per tip
  }, [nudge])

  // Keep the orb on-screen after a stored position meets a smaller viewport.
  useEffect(() => {
    const fit = () => {
      // BDG-014: the keyboard shrinks the window on Android; saving then would move the orb up for good.
      if (readViewport()?.keyboard) return
      const { side, top } = useSettingsStore.getState().buddgyOrb
      const next = clampTop(top)
      if (next !== top) setBuddgyOrb({ side, top: next })
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [setBuddgyOrb])

  // Any sheet opening makes the tip stale.
  useEffect(() => {
    if (anyModal) setNudge(null)
  }, [anyModal])

  const handlePointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const btn = btnRef.current
    if (!btn) return
    try { btn.setPointerCapture(e.pointerId) } catch { /* noop */ }
    const startX = e.clientX
    const startY = e.clientY
    let moved = false
    let last: { left: number; top: number } | null = null

    // BDG-018: the orb follows the finger on both axes, then springs to the nearer edge on release.
    const onMove = (ev: globalThis.PointerEvent) => {
      if (!moved && (Math.abs(ev.clientX - startX) > 4 || Math.abs(ev.clientY - startY) > 4)) {
        moved = true
        setDragging(true)
        setNudge(null)
      }
      if (!moved) return
      last = { left: dragLeft(ev.clientX, window.innerWidth), top: clampTop(ev.clientY - ORB_SIZE / 2) }
      setDrag(last)
    }
    const end = () => {
      btn.removeEventListener('pointermove', onMove)
      btn.removeEventListener('pointerup', onUp)
      btn.removeEventListener('pointercancel', end)
      btn.removeEventListener('lostpointercapture', end)
      setDragging(false)
      if (!last) return
      const side = snapSide(last.left + ORB_SIZE / 2, window.innerWidth, useSettingsStore.getState().buddgyOrb.side)
      const edge = side === 'left' ? EDGE_INSET : window.innerWidth - ORB_SIZE - EDGE_INSET
      setDrag({ left: edge, top: last.top, settling: true })
      setBuddgyOrb({ side, top: last.top })
      window.setTimeout(() => setDrag(null), SETTLE_MS)
    }
    const onUp = () => {
      end()
      if (!moved) onOpen()
    }
    btn.addEventListener('pointermove', onMove)
    btn.addEventListener('pointerup', onUp)
    btn.addEventListener('pointercancel', end)
    btn.addEventListener('lostpointercapture', end)
  }

  if (!aiEnabled || !userAllowsAi) return null

  const mood: BuddgyMood =
    surfaceMood !== 'idle' ? surfaceMood
    : dragging ? 'happy'
    : nudge ? (talking ? 'talking' : nudge.mood)
    : life.mood
  const status = buddgyStatusText(mood)
  const glow = mood === 'offline' || mood === 'sleepy'
    ? undefined
    : `drop-shadow(0 3px 8px color-mix(in srgb, ${buddgyMoodColor(mood)} 45%, transparent))`
  const sideStyle = (offset: number) => (orb.side === 'left' ? { left: offset } : { right: offset })

  const acceptNudge = () => {
    if (!nudge) return
    setNudge(null)
    onOpen(nudge.prompt)
  }

  return (
    <>
      {nudgesOn && <BuddgyNudgeWatcher blocked={anyModal || dragging} onNudge={setNudge} />}
      <motion.button
        ref={btnRef}
        type="button"
        onPointerDown={handlePointerDown}
        // A click with no pointer (keyboard, screen reader, switch control): the drag handler above only opens on pointer-up.
        onClick={(e) => { if (e.detail === 0) onOpen() }}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
        draggable={false}
        data-no-ptr
        title={t.modals.fabAskAi}
        aria-label={t.modals.fabAskAi}
        initial={{ scale: 0.6, opacity: 0 }}
        animate={chatOpen ? { scale: 0.2, opacity: 0 } : { scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 420, damping: 24 }}
        whileTap={{ scale: 0.9 }}
        style={{
          top: drag?.top ?? orb.top,
          ...(drag ? { left: drag.left } : sideStyle(EDGE_INSET)),
          transition: drag?.settling ? `left ${SETTLE_MS}ms cubic-bezier(.2,.8,.2,1)` : undefined,
          width: ORB_SIZE,
          height: ORB_SIZE,
          touchAction: 'none',
          pointerEvents: chatOpen ? 'none' : undefined,
          filter: glow,
        }}
        className="fixed z-50 flex items-center justify-center text-[var(--color-brand-text)] no-tap-highlight select-none cursor-grab active:cursor-grabbing"
      >
        <span ref={reactRef} className="flex">
          <BuddgyIcon mood={mood} size={48} strokeWidth={1.75} filled alive look={life.look} />
        </span>
      </motion.button>

      <AnimatePresence>
        {nudge && !chatOpen && (
          <motion.div
            key={nudge.id}
            role="status"
            initial={{ opacity: 0, scale: 0.6, x: orb.side === 'right' ? 16 : -16, y: '-50%' }}
            animate={{ opacity: 1, scale: 1, x: 0, y: '-50%' }}
            exit={{ opacity: 0, scale: 0.8, y: '-50%' }}
            transition={{ type: 'spring', stiffness: 420, damping: 28 }}
            style={{
              top: orb.top + ORB_SIZE / 2,
              ...sideStyle(EDGE_INSET + ORB_SIZE + 4),
              transformOrigin: orb.side === 'right' ? 'right center' : 'left center',
            }}
            className="fixed z-50 flex max-w-[240px] items-start gap-1 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] py-1 ps-3 pe-1 shadow-[0_12px_32px_-12px_rgba(0,0,0,0.45)]"
          >
            <button type="button" onClick={acceptNudge} className="flex-1 min-w-0 py-2 text-start text-sm leading-snug text-[var(--color-brand-text-primary)]">
              {nudge.text}
            </button>
            <IconButton onClick={() => setNudge(null)} aria-label={t.buddgy.nudgeDismiss} size="sm" shape="round">
              <X className="h-3.5 w-3.5" />
            </IconButton>
          </motion.div>
        )}
      </AnimatePresence>

      {/* State is announced here rather than inferred from the face. */}
      <span aria-live="polite" className="sr-only">{status ?? ''}</span>
    </>
  )
}
