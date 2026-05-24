'use client'

import { useCallback, useEffect, useRef } from 'react'

interface LongPressOptions {
  /** Threshold in ms before `onLongPress` fires. Default 600ms. */
  delay?: number
  /** Cancel the long-press if pointer moves more than this many pixels. Default 12. */
  moveThreshold?: number
}

interface LongPressHandlers<T extends HTMLElement> {
  onPointerDown: React.PointerEventHandler<T>
  onPointerUp: React.PointerEventHandler<T>
  onPointerLeave: React.PointerEventHandler<T>
  onPointerCancel: React.PointerEventHandler<T>
  onPointerMove: React.PointerEventHandler<T>
  onContextMenu: React.MouseEventHandler<T>
}

/**
 * Detects a long-press gesture on a single element. Calls `onLongPress` when
 * the pointer is held for `delay` ms; calls `onTap` only if the pointer was
 * released before the timer fired (and didn't move past `moveThreshold`).
 *
 * Suppresses the native context menu on touch so a long-press on the FAB
 * doesn't pop the iOS callout.
 */
export function useLongPress<T extends HTMLElement = HTMLElement>(
  onLongPress: () => void,
  onTap: () => void,
  options?: LongPressOptions,
): LongPressHandlers<T> {
  const delay = options?.delay ?? 600
  const moveThreshold = options?.moveThreshold ?? 12

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startPos = useRef<{ x: number; y: number } | null>(null)
  const longFired = useRef(false)

  const cancel = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
    startPos.current = null
  }, [])

  useEffect(() => () => cancel(), [cancel])

  const onPointerDown: React.PointerEventHandler<T> = (e) => {
    longFired.current = false
    startPos.current = { x: e.clientX, y: e.clientY }
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      longFired.current = true
      timer.current = null
      onLongPress()
    }, delay)
  }

  const onPointerUp: React.PointerEventHandler<T> = () => {
    const fired = longFired.current
    cancel()
    if (!fired) onTap()
  }

  const onPointerLeave: React.PointerEventHandler<T> = () => {
    cancel()
  }

  const onPointerCancel: React.PointerEventHandler<T> = () => {
    cancel()
  }

  const onPointerMove: React.PointerEventHandler<T> = (e) => {
    const start = startPos.current
    if (!start) return
    const dx = e.clientX - start.x
    const dy = e.clientY - start.y
    if (dx * dx + dy * dy > moveThreshold * moveThreshold) cancel()
  }

  const onContextMenu: React.MouseEventHandler<T> = (e) => {
    e.preventDefault()
  }

  return {
    onPointerDown,
    onPointerUp,
    onPointerLeave,
    onPointerCancel,
    onPointerMove,
    onContextMenu,
  }
}
