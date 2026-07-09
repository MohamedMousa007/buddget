'use client'

import { useSyncExternalStore } from 'react'

/**
 * Height (px) the open glass NumberPad occupies at the bottom of the screen.
 * ModalShell reads this and treats it like a keyboard inset, so the open modal
 * lifts its content above the pad exactly as it does for the OS keyboard.
 * 0 when no pad is open.
 */
let inset = 0
const listeners = new Set<() => void>()

export function setNumpadInset(px: number) {
  if (px === inset) return
  inset = px
  listeners.forEach((l) => l())
}

export function useNumpadInset(): number {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => inset,
    () => 0,
  )
}
