'use client'

import { useEffect, useRef } from 'react'
import { registerBackGuard } from '@/lib/navigation/backGuard'
import { useEscapeClose } from '@/hooks/useEscapeClose'

/**
 * Make an overlay dismissable by Android hardware-back and keyboard Escape.
 *
 * `ModalShell` already does this for the sheets built on it. A handful of
 * overlays deliberately do NOT use `ModalShell` — they need their own layout
 * (a scrollable centred modal, a panel that sits *below* the bottom nav's
 * z-index, a sheet containing range sliders that `ModalShell`'s drag-to-dismiss
 * would hijack). Those overlays still have to handle back and Escape: without a
 * guard, the Android back button falls through to the router and closes the
 * whole screen instead of the sheet.
 *
 * This is the dismissal half of `ModalShell` on its own, so an overlay can keep
 * its layout and still behave correctly.
 *
 * Both stacks are LIFO, so a nested overlay consumes the press and steps out one
 * layer at a time rather than tearing down everything beneath it.
 *
 * ```ts
 * useDismissable(open, onClose)
 * ```
 *
 * Do NOT use this inside a component already rendered by `ModalShell`, or inside
 * one that calls `registerBackGuard` itself — the guard would be registered
 * twice and one press would pop two layers.
 */
export function useDismissable(open: boolean, onClose: () => void): void {
  const cb = useRef(onClose)
  useEffect(() => { cb.current = onClose })

  useEffect(() => {
    if (!open) return
    return registerBackGuard(() => { cb.current(); return true })
  }, [open])

  useEscapeClose(open, () => cb.current())
}
