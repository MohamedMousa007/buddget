'use client'

import { useState, useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { motion } from 'framer-motion'
import { useShallow } from 'zustand/react/shallow'
import { checkAIStatus } from '@/lib/ai/gemini'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { useT } from '@/lib/i18n'
import { BuddgyIcon, type BuddgyMood } from '@/components/ai/BuddgyIcon'
import { useBuddgyMood, buddgyStatusText } from '@/lib/ai/useBuddgyMood'

interface AIChatBubbleProps {
  onClick: () => void
}

const ORB_SIZE = 44
const EDGE_INSET = 12

/**
 * Ring + glow colour per mood (handoff README §6). Offline is the only mood with
 * no glow — it should read as "switched off", not as another coloured state.
 */
const RING: Record<BuddgyMood, { border: string; glow: string | undefined }> = (() => {
  const teal = 'var(--color-brand-primary-bright)'
  const ring = (c: string) => ({
    border: `color-mix(in srgb, ${c} 55%, transparent)`,
    glow: `0 4px 14px -4px color-mix(in srgb, ${c} 55%, transparent)`,
  })
  return {
    idle: ring(teal),
    small: ring(teal),
    listening: ring(teal),
    thinking: ring(teal),
    scanning: ring(teal),
    done: ring('var(--color-brand-green)'),
    happy: ring('var(--color-brand-gold)'),
    alert: ring('var(--color-brand-amber)'),
    error: ring('var(--color-brand-red)'),
    offline: { border: 'var(--color-brand-border)', glow: undefined },
  }
})()

/**
 * Draggable Buddgy orb. Drags vertically, snaps to the left/right edge, and a
 * tap (no drag) opens the AI chat. Resting `{side, top}` persists in Zustand.
 *
 * The icon is `BuddgyIcon`, whose face reflects what the assistant is doing; the
 * ring and glow follow the same mood.
 */
export function AIChatBubble({ onClick }: AIChatBubbleProps) {
  const t = useT()
  const [aiEnabled, setAiEnabled] = useState(false)
  const { orb, setBuddgyOrb } = useSettingsStore(
    useShallow((s) => ({ orb: s.buddgyOrb, setBuddgyOrb: s.setBuddgyOrb })),
  )
  const mood = useBuddgyMood()
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    checkAIStatus().then((status) => setAiEnabled(status.enabled))
  }, [])

  const handlePointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const btn = btnRef.current
    if (!btn) return
    try { btn.setPointerCapture(e.pointerId) } catch { /* noop */ }
    const startX = e.clientX
    const startY = e.clientY
    let moved = false

    const onMove = (ev: globalThis.PointerEvent) => {
      if (Math.abs(ev.clientX - startX) > 4 || Math.abs(ev.clientY - startY) > 4) moved = true
      const top = Math.max(70, Math.min(window.innerHeight - 150, ev.clientY - ORB_SIZE / 2))
      const side: 'left' | 'right' = ev.clientX < window.innerWidth / 2 ? 'left' : 'right'
      setBuddgyOrb({ side, top })
    }
    const onUp = () => {
      btn.removeEventListener('pointermove', onMove)
      btn.removeEventListener('pointerup', onUp)
      if (!moved) onClick()
    }
    btn.addEventListener('pointermove', onMove)
    btn.addEventListener('pointerup', onUp)
  }

  if (!aiEnabled) return null

  const ring = RING[mood]
  const status = buddgyStatusText(mood)

  return (
    <>
      <motion.button
        ref={btnRef}
        type="button"
        onPointerDown={handlePointerDown}
        title={t.modals.fabAskAi}
        aria-label={t.modals.fabAskAi}
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 22 }}
        whileTap={{ scale: 0.92 }}
        style={{
          top: orb.top,
          ...(orb.side === 'left' ? { left: EDGE_INSET } : { right: EDGE_INSET }),
          width: ORB_SIZE,
          height: ORB_SIZE,
          touchAction: 'none',
          borderColor: ring.border,
          boxShadow: ring.glow,
        }}
        className="fixed z-50 flex items-center justify-center rounded-full border-[1.5px] bg-[var(--color-brand-elevated)] text-[var(--color-brand-text)] opacity-95 transition-[border-color,box-shadow] duration-200 hover:opacity-100 cursor-grab active:cursor-grabbing"
      >
        <BuddgyIcon mood={mood} size={24} />
      </motion.button>
      {/* State is announced here rather than inferred from the face. */}
      <span aria-live="polite" className="sr-only">{status ?? ''}</span>
    </>
  )
}
