'use client'

import { useState, useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { checkAIStatus } from '@/lib/ai/gemini'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { useT } from '@/lib/i18n'

interface AIChatBubbleProps {
  onClick: () => void
}

const ORB_SIZE = 44
const EDGE_INSET = 12

/**
 * Draggable Buddgy orb. Drags vertically, snaps to the left/right edge, and a
 * tap (no drag) opens the AI chat. Resting `{side, top}` persists in Zustand.
 */
export function AIChatBubble({ onClick }: AIChatBubbleProps) {
  const t = useT()
  const [aiEnabled, setAiEnabled] = useState(false)
  const { orb, setBuddgyOrb } = useSettingsStore(
    useShallow((s) => ({ orb: s.buddgyOrb, setBuddgyOrb: s.setBuddgyOrb })),
  )
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

  return (
    <button
      ref={btnRef}
      type="button"
      onPointerDown={handlePointerDown}
      title={t.modals.fabAskAi}
      aria-label={t.modals.fabAskAi}
      style={{
        top: orb.top,
        ...(orb.side === 'left' ? { left: EDGE_INSET } : { right: EDGE_INSET }),
        width: ORB_SIZE,
        height: ORB_SIZE,
        touchAction: 'none',
      }}
      className="fixed z-50 flex items-center justify-center overflow-hidden rounded-full border-[1.5px] border-[rgba(229,9,20,0.5)] opacity-95 shadow-[0_4px_14px_-4px_rgba(229,9,20,0.55)] transition-opacity duration-200 hover:opacity-100 cursor-grab active:cursor-grabbing"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/buddgy/buddgy-square.png" alt="" className="h-full w-full object-cover select-none" draggable={false} />
    </button>
  )
}
