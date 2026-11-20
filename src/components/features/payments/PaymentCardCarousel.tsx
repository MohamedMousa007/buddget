'use client'

import { useT } from '@/lib/i18n'
import { createElement, useRef, useState } from 'react'
import { MoreVertical, Plus } from 'lucide-react'
import { paymentTypeIcon } from '@/lib/constants/categoryGrid'
import { decomposePaymentMethodName } from '@/lib/payment/paymentMethodDefaults'
import { CARD_THEMES, cardBankName, cardLook } from '@/lib/payment/cardThemes'
import { INK_DARK, INK_LIGHT } from '@/lib/ui/contrast'
import type { PaymentMethod, PaymentMethodType } from '@/lib/store/types'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { IconButton } from '@/components/ui/IconButton'
import { cardKindLabel, cardNetworkIfKnown } from '@/components/features/accounts/accountDisplay'
import { CardFace, FACE_W } from './CardFace'

export function TypeGlyph({ type, className }: { type: PaymentMethodType; className?: string }) {
  return createElement(paymentTypeIcon(type), { className })
}

const CARD_W = 252
const CARD_H = 159
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
  onMenu?: (id: string, anchor: DOMRect) => void
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
  const t = useT()
  const allMethods = useFinanceStore((s) => s.paymentMethods)
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

  // Keyboard and screen-reader path: the cards are pointer-driven, so the carousel itself takes the arrows and Enter.
  const activeMethod = methods[safeActive]
  const activeLabel = activeMethod
    ? `${decomposePaymentMethodName(activeMethod.name, activeMethod.last4).provider} ${activeMethod.label?.trim() || (activeMethod.last4 ? `•• ${activeMethod.last4}` : '')}`.trim()
    : addLabel
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.target !== e.currentTarget) return // keys on the card's own menu button stay with that button
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); onActiveChange(Math.min(slotCount - 1, safeActive + 1)) }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); onActiveChange(Math.max(0, safeActive - 1)) }
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (activeMethod) onCardSelect?.(activeMethod)
      else onAddCard?.()
    }
  }

  return (
    <>
      <div
        role="group"
        tabIndex={0}
        aria-label={activeLabel}
        onKeyDown={onKeyDown}
        className="relative mt-2.5 h-[224px] touch-pan-y select-none rounded-[20px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-focus)]"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {methods.map((m, i) => {
          const isSelected = selectedId != null && m.id === selectedId
          const { style, theme } = cardLook(m)
          const parent = m.parentId ? allMethods.find((p) => p.id === m.parentId) : undefined
          const label = m.label?.trim()
          return (
            <div
              key={m.id}
              className="absolute start-1/2 top-1.5"
              style={slotStyle(i)}
              onClick={() => tapSlot(i, () => onCardSelect?.(m))}
            >
              <CardFace
                theme={theme}
                style={style}
                bank={cardBankName(m, parent)}
                kind={cardKindLabel(m.type, t.accountsPage)}
                last4={m.last4}
                holder={label || (onMenu || isSelected ? m.currency : undefined)}
                currency={m.currency}
                network={cardNetworkIfKnown(m)}
                defaultLabel={m.isDefault && defaultLabel ? defaultLabel : undefined}
                selected={!onMenu && isSelected}
                reserveTopRight={!!onMenu}
                scale={CARD_W / FACE_W}
              >
                {onMenu ? (
                  <IconButton
                    size="sm"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); onMenu(m.id, e.currentTarget.getBoundingClientRect()) }}
                    aria-label={t.a11y.manage}
                    aria-haspopup="menu"
                    className="absolute right-1 top-1 text-inherit hover:bg-[color-mix(in_oklab,currentColor_15%,transparent)] hover:text-inherit"
                    style={{ color: CARD_THEMES[theme].ink === 'light' ? INK_LIGHT : INK_DARK }}
                  >
                    <MoreVertical />
                  </IconButton>
                ) : null}
              </CardFace>
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
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-[10px] border border-dashed border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-brand-primary)]/12 text-[var(--color-brand-primary-ink)]">
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
              background: i === safeActive ? 'var(--color-brand-primary-bright)' : 'var(--color-brand-border)',
            }}
          />
        ))}
      </div>
      <div className="mt-3 text-center text-[0.78125rem] font-medium text-[var(--color-brand-text-muted)]">{hint}</div>
    </>
  )
}
