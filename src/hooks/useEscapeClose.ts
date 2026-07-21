'use client'

import { useEffect, useRef } from 'react'

/**
 * Close modal/sheet on Escape — LIFO stack so only the TOPMOST open layer closes.
 * Mirrors the hardware back-button guard (runBackGuards), so keyboard Escape and
 * Android back both step out one sheet at a time instead of dismissing the whole
 * stack (a nested picker no longer closes the primary sheet behind it).
 */
type Entry = { fn: () => void }
const stack: Entry[] = []
let listening = false

function ensureListener() {
  if (listening || typeof window === 'undefined') return
  listening = true
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.key !== 'Escape' || stack.length === 0) return
      // Only the last-registered (topmost) layer consumes the press.
      stack[stack.length - 1].fn()
    },
    // Capture so it wins before inputs, matching the previous behaviour.
    true,
  )
}

export function useEscapeClose(isOpen: boolean, onClose: () => void) {
  const cb = useRef(onClose)
  useEffect(() => {
    cb.current = onClose
  })
  useEffect(() => {
    if (!isOpen) return
    ensureListener()
    const entry: Entry = { fn: () => cb.current() }
    stack.push(entry)
    return () => {
      const i = stack.indexOf(entry)
      if (i !== -1) stack.splice(i, 1)
    }
  }, [isOpen])
}
