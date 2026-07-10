'use client'

import { createElement, useRef } from 'react'
import { MoreVertical } from 'lucide-react'
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
/** A horizontal swipe past this many px advances exactly one card (snappy, not loose). */
const SWIPE_THRESHOLD = 45

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
}

/**
 * Swipeable payment-card carousel. One card per swipe (snaps), peek neighbours,
 * tap a neighbour to focus it, tap the focused card to select. Shared by the
 * wallet management sheet and the payment-method picker.
 */
export function PaymentCardCarousel({
  methods, active, onActiveChange, defaultLabel, hint, onCardSelect, onMenu, selectedId,
}: Props) {
  const gesture = useRef<{ x: number; y: number } | null>(null)
  const swiped = useRef(false)
  const safeActive = Math.min(active, Math.max(0, methods.length - 1))

  const onPointerDown = (e: React.PointerEvent) => {
    gesture.current = { x: e.clientX, y: e.clientY }
    swiped.current = false
  }
  const onPointerUp = (e: React.PointerEvent) => {
    const g = gesture.current
    gesture.current = null
    if (!g) return
    const dx = e.clientX - g.x
    const dy = e.clientY - g.y
    if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
      swiped.current = true
      const next = Math.max(0, Math.min(methods.length - 1, safeActive + (dx < 0 ? 1 : -1)))
      if (next !== safeActive) onActiveChange(next)
    }
  }

  return (
    <>
      <div
        className="relative mt-2.5 h-[224px] touch-pan-y select-none"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      >
        {methods.map((m, i) => {
          const off = i - safeActive
          const isActiveCard = i === safeActive
          const hidden = Math.abs(off) > 2
          const color = m.color ?? PAYMENT_TYPE_META[m.type].color
          const { provider, tag } = decomposePaymentMethodName(m.name, m.last4)
          const tail = m.last4 ? `•••• ${m.last4}` : tag || '—'
          const isSelected = selectedId != null && m.id === selectedId
          return (
            <div
              key={m.id}
              className="absolute start-1/2 top-1.5"
              style={{
                width: CARD_W, height: CARD_H, marginInlineStart: -CARD_W / 2,
                transform: `translateX(${off * 132}px) scale(${isActiveCard ? 1 : 0.82})`,
                opacity: hidden ? 0 : isActiveCard ? 1 : 0.4,
                zIndex: 20 - Math.abs(off),
                transition: 'transform .38s cubic-bezier(.22,1,.36,1), opacity .3s',
                pointerEvents: hidden ? 'none' : 'auto',
              }}
              onClick={() => {
                if (swiped.current) { swiped.current = false; return }
                if (!isActiveCard) onActiveChange(i)
                else onCardSelect?.(m)
              }}
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
      </div>

      <div className="mt-1.5 flex items-center justify-center gap-1.5">
        {methods.map((m, i) => (
          <span
            key={m.id}
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
