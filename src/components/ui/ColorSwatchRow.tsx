'use client'

import { Check } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { CARD_COLORS } from '@/lib/payment/paymentMethodDefaults'
import { HIT_AREA } from '@/lib/ui/hitArea'
import { inkFor } from '@/lib/ui/contrast'

/**
 * App-wide horizontal colour picker — the payment-methods swatch row, globalised. Cards, pockets,
 * and anything user-colourable share this control and the {@link CARD_COLORS} palette. Stores a hex
 * string; consumers must render any hex (don't assume a fixed set).
 *
 * A radiogroup: the selected swatch is `aria-checked` and drawn with a focus-token ring plus a check
 * glyph in a readable ink, so it shows in both themes and is not colour-only.
 */
export interface ColorSwatchRowProps {
  value: string
  onChange: (hex: string) => void
  /** Override the palette (defaults to the shared CARD_COLORS). */
  colors?: readonly string[]
  className?: string
}

export function ColorSwatchRow({ value, onChange, colors = CARD_COLORS, className }: ColorSwatchRowProps) {
  const a = useT().a11y
  return (
    <div role="radiogroup" aria-label={a.colourGroup} className={`native-scroll flex gap-2.5 overflow-x-auto px-1 py-1 ${className ?? ''}`}>
      {colors.map((c) => {
        const selected = value === c
        return (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(c)}
            aria-label={a.colour(c)}
            className={`${HIT_AREA} flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px]`}
            style={{
              background: c,
              color: inkFor(c),
              boxShadow: selected
                ? '0 0 0 2px var(--color-brand-card), 0 0 0 4px var(--color-brand-focus)'
                : '0 0 0 1px rgba(255,255,255,.12)',
            }}
          >
            {selected ? <Check aria-hidden className="size-[18px]" strokeWidth={3} /> : null}
          </button>
        )
      })}
    </div>
  )
}
