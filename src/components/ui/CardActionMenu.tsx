'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useDismissable } from '@/hooks/useDismissable'

/**
 * App-wide kebab (⋮) action menu for cards — pockets, payment methods, debts, income, subscriptions.
 * Anchored to the tapped trigger's rect (not a fixed page offset), scrim-dismissed, portalled above
 * everything. Design-system rule: cards expose a ⋮ that opens THIS menu with Edit / Delete (+ any
 * extras); destructive items are red and should be guarded by `useConfirm`. Replaces per-surface
 * bespoke menus and the old pen-icon + inline-delete pattern.
 */
export interface CardMenuItem {
  label: string
  icon?: React.ReactNode
  destructive?: boolean
  disabled?: boolean
  /** Muted second line under the label; omit on ordinary items. */
  hint?: string
  onSelect: () => void
}

export interface CardActionMenuProps {
  /** The trigger's bounding rect, captured on click; null closes the menu. */
  anchor: DOMRect | null
  items: CardMenuItem[]
  onClose: () => void
  /** Optional heading (e.g. "CIB ••2016"). */
  title?: string
  /** Stacking class; raise it to open the menu from inside a sheet. */
  zClassName?: string
}

/** Arrow keys, Home and End move between the enabled items (APG menu); other keys are left alone. */
export function nextMenuIndex(count: number, current: number, key: string): number | null {
  if (count === 0) return null
  if (key === 'ArrowDown') return (current + 1) % count
  if (key === 'ArrowUp') return (current - 1 + count) % count
  if (key === 'Home') return 0
  if (key === 'End') return count - 1
  return null
}

function menuKeyTarget(menu: HTMLElement | null, key: string): HTMLElement | null {
  const items = Array.from(menu?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [])
  const next = nextMenuIndex(items.length, items.indexOf(document.activeElement as HTMLElement), key)
  return next === null ? null : items[next]
}

const WIDTH = 216
const ROW = 44
const GAP = 6
const EDGE = 8

export interface MenuPlacementInput {
  anchor: Pick<DOMRect, 'top' | 'bottom' | 'left' | 'right'>
  /** The menu's rendered height (or the first estimate before it is measured). */
  height: number
  viewportW: number
  viewportH: number
  /** The bottom safe-area inset (home indicator). */
  insetBottom?: number
  rtl?: boolean
}

/**
 * Where the menu sits: under the trigger, aligned to its end edge (right in LTR, left in RTL), inside the viewport.
 * Near the bottom (or over the home indicator) it flips above the trigger; with room on neither side it pins to the
 * bottom edge. LTR with room below lands where it always has.
 */
export function placeMenu({ anchor, height, viewportW, viewportH, insetBottom = 0, rtl = false }: MenuPlacementInput): { top: number; left: number } {
  const left = Math.max(EDGE, Math.min(rtl ? anchor.left : anchor.right - WIDTH, viewportW - WIDTH - EDGE))
  const floor = viewportH - EDGE - insetBottom
  const below = anchor.bottom + GAP
  if (below + height <= floor) return { top: below, left }
  const above = anchor.top - GAP - height
  if (above >= EDGE) return { top: above, left }
  return { top: Math.max(EDGE, floor - height), left }
}

/** The bottom safe-area inset in px, read from a probe padded with env(). */
function bottomInset(): number {
  const probe = document.createElement('div')
  probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding-bottom:env(safe-area-inset-bottom, 0px)'
  document.body.appendChild(probe)
  const v = parseFloat(getComputedStyle(probe).paddingBottom) || 0
  probe.remove()
  return v
}

export function CardActionMenu({ anchor, items, onClose, title, zClassName = 'z-[60]' }: CardActionMenuProps) {
  useDismissable(anchor !== null, onClose)
  const menuRef = useRef<HTMLDivElement>(null)
  const open = anchor !== null
  const [box, setBox] = useState<{ height: number; inset: number } | null>(null)
  useLayoutEffect(() => {
    const el = menuRef.current
    // eslint-disable-next-line react-hooks/set-state-in-effect -- measures the rendered menu before paint
    setBox(el ? { height: el.offsetHeight, inset: bottomInset() } : null)
  }, [anchor, items.length, title])
  useEffect(() => {
    if (!open) return
    const opener = document.activeElement as HTMLElement | null
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])')?.focus()
    return () => opener?.focus?.()
  }, [open])
  // Only ever rendered from a client click (anchor is a live DOMRect), so no SSR guard needed
  // beyond confirming document exists for the portal target.
  if (!anchor || typeof document === 'undefined') return null

  // Rows with a hint are taller than ROW, so the rendered height replaces the estimate once it is measured.
  const height = box?.height ?? items.length * ROW + (title ? 40 : 0)
  const rtl = document.documentElement.dir === 'rtl'
  const { top, left } = placeMenu({ anchor, height, viewportW: window.innerWidth, viewportH: window.innerHeight, insetBottom: box?.inset ?? 0, rtl })

  return createPortal(
    <div className={`fixed inset-0 ${zClassName}`} onClick={onClose} role="presentation">
      <div
        ref={menuRef}
        role="menu"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          const target = menuKeyTarget(menuRef.current, e.key)
          if (!target) return
          e.preventDefault()
          target.focus()
        }}
        className="absolute overflow-hidden rounded-[14px] border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]"
        style={{ top, left, width: WIDTH, boxShadow: 'var(--shadow-lg)' }}
      >
        {title && (
          <div className="truncate border-b border-[var(--color-brand-border)] px-3.5 py-2 text-[0.71875rem] font-semibold text-[var(--color-brand-text-muted)]">
            {title}
          </div>
        )}
        {items.map((it, i) => (
          <button
            key={i}
            type="button"
            role="menuitem"
            disabled={it.disabled}
            aria-disabled={it.disabled || undefined}
            onClick={() => { onClose(); it.onSelect() }}
            className="flex min-h-11 w-full items-center gap-2.5 px-3.5 py-2 text-start text-sm font-medium disabled:cursor-not-allowed disabled:opacity-45"
            style={{ color: it.destructive ? 'var(--color-brand-red)' : 'var(--color-brand-text-primary)', borderTop: i > 0 ? '1px solid var(--color-brand-border)' : undefined }}
          >
            {it.icon}
            <span className="flex min-w-0 flex-col">
              <span className="truncate">{it.label}</span>
              {it.hint && (
                <span className="truncate text-[0.71875rem] font-normal text-[var(--color-brand-text-muted)]">{it.hint}</span>
              )}
            </span>
          </button>
        ))}
      </div>
    </div>,
    document.body,
  )
}
