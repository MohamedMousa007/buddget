'use client'

import { createElement, useRef, useState } from 'react'
import { MoreVertical, Plus } from 'lucide-react'
import { paymentTypeIcon } from '@/lib/constants/categoryGrid'
import { PAYMENT_TYPE_META, decomposePaymentMethodName } from '@/lib/payment/paymentMethodDefaults'
import type { PaymentMethod, PaymentMethodType } from '@/lib/store/types'

// ── card gradient helpers (shared with the setup preview) ───────────────────
export function shade(hex: string, f: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16)
  const m = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)))
  return `rgb(${m(r)},${m(g)},${m(b)})`
}
export function cardGradient(color: string): string {
  return `linear-gradient(140deg, ${shade(color, 1.18)} 0%, ${color} 48%, ${shade(color, 0.6)} 100%)`
}

export function TypeGlyph({ type, className }: { type: PaymentMethodType; className?: string }) {
  return createElement(paymentTypeIcon(type), { className })
}

const CARD_W = 252
const CARD_H = 158
const STEP = 132 // px between adjacent card centres
const TAP_SLOP = 6 // movement under this many px counts as a tap, not a drag

interface Props {
  methods: PaymentMethod[]
  active: number
  onActiveChange: (i: number) => void
  defaultLabel: string
  hint: string
  /** Tap the focused (centered) card. */
  onCardSelect?: (m: PaymentMethod) => void
  /** ⋯ button per card (manage mode). Omit to hide it (select mode). */
  onMenu?: (id: string) => void
  /** Highlight the currently-selected method with a ring (select mode). */
  selectedId?: string
  /** Append a dashed “+” add tile; tapping it (focused) fires this. */
  onAddCard?: () => void
  addLabel?: string
}

/**
 * Swipeable payment-card carousel. The deck follows the finger live and snaps to
 * the nearest card on release (like a slider) — you must drag past half a card to
 * advance. Tap a neighbour to focus it, tap the focused card to select. Shared by
 * the wallet management sheet and the payment-method picker.
 */
export function PaymentCardCarousel({
  methods, active, onActiveChange, defaultLabel, hint, onCardSelect, onMenu, selectedId, onAddCard, addLabel,
}: Props) {
  const slotCount = methods.length + (onAddCard ? 1 : 0)
  const start = useRef<{ x: number; y: number } | null>(null)
  const didDrag = useRef(false)
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)

  const safeActive = Math.min(Math.max(active, 0), Math.max(0, slotCount - 1))

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    start.current = { x: e.clientX, y: e.clientY }
    didDrag.current = false
    setDragging(true)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const s = start.current
    if (!s) return
    const dx = e.clientX - s.x
    const dy = e.clientY - s.y
    if (!didDrag.current) {
      if (Math.abs(dx) < TAP_SLOP && Math.abs(dy) < TAP_SLOP) return
      if (Math.abs(dy) > Math.abs(dx)) { start.current = null; setDragging(false); return } // vertical → let it scroll
      didDrag.current = true
    }
    setDragX(dx)
  }
  const endDrag = (e: React.PointerEvent) => {
    const s = start.current
    start.current = null
    setDragging(false)
    if (!s || !didDrag.current) { setDragX(0); return }
    const pos = safeActive - (e.clientX - s.x) / STEP
    const next = Math.min(Math.max(Math.round(pos), 0), slotCount - 1)
    setDragX(0)
    if (next !== safeActive) onActiveChange(next)
  }

  const pos = dragging
    ? Math.min(Math.max(safeActive - dragX / STEP, -0.35), slotCount - 1 + 0.35)
    : safeActive

  const slotStyle = (i: number): React.CSSProperties => {
    const off = i - pos
    const abs = Math.abs(off)
    return {
      width: CARD_W, height: CARD_H, marginInlineStart: -CARD_W / 2,
      transform: `translateX(${off * STEP}px) scale(${Math.max(0.82, 1 - abs * 0.18)})`,
      opacity: abs > 2.2 ? 0 : Math.max(0, 1 - abs * 0.6),
      zIndex: 20 - Math.round(abs),
      transition: dragging ? 'none' : 'transform .38s cubic-bezier(.22,1,.36,1), opacity .3s',
      pointerEvents: abs > 2.2 ? 'none' : 'auto',
    }
  }
  const tapSlot = (i: number, action: () => void) => {
    if (didDrag.current) return
    if (i !== safeActive) onActiveChange(i)
    else action()
  }

  return (
    <>
      <div
        className="relative mt-2.5 h-[224px] touch-pan-y select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {methods.map((m, i) => {
          const color = m.color ?? PAYMENT_TYPE_META[m.type].color
          const { provider, tag } = decomposePaymentMethodName(m.name, m.last4)
          const tail = m.last4 ? `•••• ${m.last4}` : tag || '—'
          const isSelected = selectedId != null && m.id === selectedId
          return (
            <div
              key={m.id}
              className="absolute start-1/2 top-1.5"
              style={slotStyle(i)}
              onClick={() => tapSlot(i, () => onCardSelect?.(m))}
            >
              <div
                className="relative flex h-full w-full flex-col rounded-[20px] p-4 px-[18px] text-start"
                style={{
                  background: cardGradient(color),
                  boxShadow: `0 18px 40px -14px ${shade(color, 0.5)}, inset 0 1px 0 rgba(255,255,255,.16)${isSelected ? ', 0 0 0 2px #E50914, 0 0 0 4px rgba(229,9,20,.35)' : ''}`,
                }}
              >
                <div
                  className="pointer-events-none absolute inset-0 rounded-[20px]"
                  style={{ background: 'radial-gradient(120% 90% at 85% 8%, rgba(255,255,255,.16), transparent 60%)' }}
                />
                {m.isDefault && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <span className="font-sans text-[32px] font-extrabold uppercase tracking-[0.2em] text-white/15">
                      {defaultLabel}
                    </span>
                  </div>
                )}
                <div className="relative flex items-start justify-between">
                  <span className="flex h-8 w-[42px] shrink-0 items-center justify-center rounded-lg bg-white/20 p-[7px] text-white">
                    <TypeGlyph type={m.type} className="h-full w-full" />
                  </span>
                  {onMenu && (
                    <button
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => { e.stopPropagation(); onMenu(m.id) }}
                      aria-label="Manage"
                      className="-mr-1.5 -mt-0.5 flex h-7 w-7 items-center justify-center bg-transparent p-[3px] text-white/90"
                    >
                      <MoreVertical className="h-full w-full" />
                    </button>
                  )}
                </div>
                <div className="relative mt-auto text-start">
                  <div className="truncate text-[21px] font-bold tracking-[-0.01em] text-white">{provider}</div>
                  <div className="mt-2.5 flex items-end justify-between">
                    <span className="font-mono-numbers text-sm font-semibold tracking-[0.14em] text-white/90">{tail}</span>
                    <span className="font-mono-numbers text-xs font-bold text-white/80">{m.currency}</span>
                  </div>
                </div>
              </div>
            </div>
          )
        })}

        {onAddCard && (
          <div
            key="__add"
            className="absolute start-1/2 top-1.5"
            style={slotStyle(methods.length)}
            onClick={() => tapSlot(methods.length, onAddCard)}
          >
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-[20px] border border-dashed border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-brand-red)]/12 text-[var(--color-brand-red)]">
                <Plus className="h-6 w-6" />
              </span>
              <span className="text-sm font-semibold text-[var(--color-brand-text-secondary)]">
                {addLabel}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="mt-1.5 flex items-center justify-center gap-1.5">
        {Array.from({ length: slotCount }).map((_, i) => (
          <span
            key={i}
            className="h-1.5 rounded-full transition-all"
            style={{
              width: i === safeActive ? 18 : 6,
              background: i === safeActive ? '#E50914' : 'var(--color-brand-border)',
            }}
          />
        ))}
      </div>
      <div className="mt-3 text-center text-[12.5px] font-medium text-[var(--color-brand-text-muted)]">{hint}</div>
    </>
  )
}
