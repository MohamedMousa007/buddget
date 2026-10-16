'use client'

import { createPortal } from 'react-dom'

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
}

const WIDTH = 216
const ROW = 44

export function CardActionMenu({ anchor, items, onClose, title }: CardActionMenuProps) {
  // Only ever rendered from a client click (anchor is a live DOMRect), so no SSR guard needed
  // beyond confirming document exists for the portal target.
  if (!anchor || typeof document === 'undefined') return null

  // Position under the trigger, right-aligned to it, clamped to the viewport.
  const left = Math.max(8, Math.min(anchor.right - WIDTH, window.innerWidth - WIDTH - 8))
  const top = Math.min(anchor.bottom + 6, window.innerHeight - 8 - items.length * ROW - (title ? 40 : 0))

  return createPortal(
    <div className="fixed inset-0 z-[60]" onClick={onClose} role="presentation">
      <div
        role="menu"
        onClick={(e) => e.stopPropagation()}
        className="absolute overflow-hidden rounded-[14px] border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]"
        style={{ top, left, width: WIDTH, boxShadow: 'var(--shadow-lg)' }}
      >
        {title && (
          <div className="truncate border-b border-[var(--color-brand-border)] px-3.5 py-2 text-[11.5px] font-semibold text-[var(--color-brand-text-muted)]">
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
                <span className="truncate text-[11.5px] font-normal text-[var(--color-brand-text-muted)]">{it.hint}</span>
              )}
            </span>
          </button>
        ))}
      </div>
    </div>,
    document.body,
  )
}
