'use client'

import { useEffect, type RefObject } from 'react'
import { inertBackground } from '@/lib/ui/inertBackground'

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Minimal element shape the trap reads, so the rules below can be tested without a DOM. */
export interface TabCandidate {
  tabIndex: number
  disabled?: boolean
  offsetParent: unknown
  getClientRects(): { length: number }
  closest(selector: string): unknown
}

/**
 * Whether Tab can actually land on a node the selector matched. A disabled button that still carries
 * `tabindex="0"` (Base UI's Button does) matches `[tabindex]` but is skipped by the browser; counting it as the
 * last node meant Tab from the real last control never wrapped and left the sheet (Expense, Money in, Savings).
 */
export function isTabbable(node: TabCandidate): boolean {
  if (node.disabled === true || node.tabIndex < 0 || node.closest('[inert]')) return false
  return node.offsetParent !== null || node.getClientRects().length > 0
}

/**
 * Where Tab should go instead of its default, or null to let the browser move focus inside the panel.
 * `activeInPanel` is whether focus sits on a descendant of the panel (not the panel itself): focus on the panel
 * or anywhere outside it is pulled to the first (Tab) or last (Shift+Tab) node.
 */
export function trapTarget<T>(nodes: readonly T[], active: unknown, activeInPanel: boolean, shift: boolean): T | null {
  if (nodes.length === 0) return null
  const first = nodes[0]
  const last = nodes[nodes.length - 1]
  if (!activeInPanel) return shift ? last : first
  if (shift) return active === first ? last : null
  return active === last ? first : null
}

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
      const nodes = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(isTabbable)
      const active = document.activeElement
      const target = trapTarget(nodes, active, active !== el && el.contains(active), e.shiftKey)
      if (!target) return
      e.preventDefault()
      target.focus()
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
