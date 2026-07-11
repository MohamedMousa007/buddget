'use client'

import { useEffect } from 'react'

/**
 * Ref-counted background scroll lock. Every open overlay (ModalShell sheets,
 * numpad, More sheet, date picker, auth modal, …) locks the window scroll so a
 * touch-drag on the backdrop / non-scrolling chrome can't bleed through and
 * scroll the page behind it. Ref-counting is required so nested sheets compose:
 * the previous ad-hoc locks restored `overflow=''` on close, which clobbered a
 * still-open parent's lock. Only the first lock captures / the last release
 * restores.
 */
let count = 0
let saved = ''

export function lockScroll(): void {
  if (typeof document === 'undefined') return
  if (count === 0) {
    saved = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
  count++
}

export function unlockScroll(): void {
  if (typeof document === 'undefined') return
  count = Math.max(0, count - 1)
  if (count === 0) document.body.style.overflow = saved
}

export function isScrollLocked(): boolean {
  return count > 0
}

/** Lock the background scroll while `active` is true. */
export function useScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return
    lockScroll()
    return unlockScroll
  }, [active])
}
