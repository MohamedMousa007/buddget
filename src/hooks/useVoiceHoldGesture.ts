'use client'

import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'
import { useMotionValue } from 'framer-motion'

const HOLD_MS = 300 // press duration before recording starts (shorter than a tap-to-menu)
const SCROLL_CANCEL_PX = 16 // movement before the hold fires that aborts it (treat as scroll)
const TRASH_RADIUS = 72 // finger-to-trash distance that arms cancel

interface VoiceHoldOptions {
  /** Fires when the press passes the hold threshold — begin recording. */
  onHoldStart: () => void
  /** Fires when released in place — stop & transcribe. */
  onHoldEnd: () => void
  /** Fires when released over the trash, or on a system interruption — discard. */
  onHoldCancel: () => void
  /** Fires on a quick tap (released before the hold threshold). */
  onTap: () => void
  /** The trash drop-zone element, measured live to compute proximity. */
  trashRef: RefObject<HTMLDivElement | null>
}

/**
 * One continuous pointer gesture for hold-to-record with drag-to-trash.
 *
 * Uses setPointerCapture so move/up/cancel always route back to the FAB even
 * when the finger leaves the button bounds — this is what guarantees the
 * recording always stops on release (the old useLongPress orphaned it on
 * pointerleave). While recording, the live finger position is exposed via
 * posX/posY motion values so the recording widget can follow the finger, and
 * nearTrash flips when the finger enters the trash drop-zone.
 */
export function useVoiceHoldGesture({
  onHoldStart,
  onHoldEnd,
  onHoldCancel,
  onTap,
  trashRef,
}: VoiceHoldOptions) {
  // Live absolute finger coordinates (clientX/clientY) — drive the widget.
  const posX = useMotionValue(0)
  const posY = useMotionValue(0)
  const [nearTrash, setNearTrash] = useState(false)

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const holdingRef = useRef(false) // true once recording has begun
  const startRef = useRef<{ x: number; y: number } | null>(null)
  const nearTrashRef = useRef(false)
  const pointerIdRef = useRef<number | null>(null)

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const haptic = useCallback(async (style: 'light' | 'medium') => {
    try {
      const { Haptics, ImpactStyle } = await import('@capacitor/haptics')
      await Haptics.impact({ style: style === 'medium' ? ImpactStyle.Medium : ImpactStyle.Light })
    } catch {
      /* web / unsupported — no-op */
    }
  }, [])

  const reset = useCallback(() => {
    clearTimer()
    holdingRef.current = false
    startRef.current = null
    nearTrashRef.current = false
    pointerIdRef.current = null
    setNearTrash(false)
    posX.set(0)
    posY.set(0)
  }, [posX, posY])

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return
      startRef.current = { x: e.clientX, y: e.clientY }
      pointerIdRef.current = e.pointerId
      holdingRef.current = false
      nearTrashRef.current = false
      setNearTrash(false)
      posX.set(e.clientX)
      posY.set(e.clientY)
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        /* capture unsupported — gesture still works while finger stays on button */
      }
      clearTimer()
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        holdingRef.current = true
        void haptic('medium')
        onHoldStart()
      }, HOLD_MS)
    },
    [haptic, onHoldStart, posX, posY],
  )

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      const start = startRef.current
      if (!start) return

      if (!holdingRef.current) {
        // Before the hold fires: a real drag means the user is scrolling — abort.
        const dx = e.clientX - start.x
        const dy = e.clientY - start.y
        if (dx * dx + dy * dy > SCROLL_CANCEL_PX * SCROLL_CANCEL_PX) {
          clearTimer()
          startRef.current = null
        }
        return
      }

      // Recording: widget tracks the finger.
      posX.set(e.clientX)
      posY.set(e.clientY)

      const trash = trashRef.current
      if (trash) {
        const r = trash.getBoundingClientRect()
        const dist = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2))
        const near = dist < TRASH_RADIUS
        if (near !== nearTrashRef.current) {
          nearTrashRef.current = near
          setNearTrash(near)
          if (near) void haptic('light')
        }
      }
    },
    [haptic, posX, posY, trashRef],
  )

  const onPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      try {
        if (pointerIdRef.current != null) e.currentTarget.releasePointerCapture(pointerIdRef.current)
      } catch {
        /* no-op */
      }
      const wasHolding = holdingRef.current
      const overTrash = nearTrashRef.current
      const pendingTap = timerRef.current != null && startRef.current != null
      reset()
      if (wasHolding) {
        if (overTrash) onHoldCancel()
        else onHoldEnd()
      } else if (pendingTap) {
        onTap()
      }
    },
    [onHoldCancel, onHoldEnd, onTap, reset],
  )

  const onPointerCancel = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      try {
        if (pointerIdRef.current != null) e.currentTarget.releasePointerCapture(pointerIdRef.current)
      } catch {
        /* no-op */
      }
      const wasHolding = holdingRef.current
      // iOS/Capacitor fires pointercancel instead of pointerup on quick taps when
      // setPointerCapture is active — treat as tap if the hold timer hadn't fired yet.
      const pendingTap = timerRef.current != null && startRef.current != null
      reset()
      if (wasHolding) onHoldCancel()
      else if (pendingTap) onTap()
    },
    [onHoldCancel, onTap, reset],
  )

  const onContextMenu = useCallback((e: ReactPointerEvent<HTMLButtonElement>) => {
    e.preventDefault() // suppress the iOS long-press callout
  }, [])

  return {
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onContextMenu },
    posX,
    posY,
    nearTrash,
  }
}
