'use client'

import { useEffect, type RefObject } from 'react'
import { inertBackground } from '@/lib/ui/inertBackground'

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Modal focus contract: focus the panel on open, trap Tab inside it, make the page behind it inert,
 * and give focus back to the opener on close. The panel element needs `tabIndex={-1}`.
 * `keepInnerFocus` leaves focus alone when a field inside the panel already claimed it.
 */
export function useDialogFocus(open: boolean, panelRef: RefObject<HTMLElement | null>, keepInnerFocus = false) {
  useEffect(() => {
    if (!open) return
    const el = panelRef.current
    if (!el) return

    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const id = requestAnimationFrame(() => {
      if (!keepInnerFocus || !el.contains(document.activeElement)) el.focus()
    })

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const nodes = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (node) => node.offsetParent !== null || node.getClientRects().length > 0
      )
      if (nodes.length === 0) return
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      const active = document.activeElement as HTMLElement | null
      if (e.shiftKey) {
        if (active === first || active === el) {
          e.preventDefault()
          last.focus()
        }
      } else if (active === last) {
        e.preventDefault()
        first.focus()
      }
    }

    el.addEventListener('keydown', onKeyDown)
    const restoreBackground = inertBackground(el)
    return () => {
      restoreBackground()
      cancelAnimationFrame(id)
      el.removeEventListener('keydown', onKeyDown)
      const active = document.activeElement
      if (opener?.isConnected && (active === document.body || el.contains(active) || active?.hasAttribute('data-modal-backdrop'))) opener.focus()
    }
  }, [open, panelRef, keepInnerFocus])
}
