'use client'

import { CARD_COLORS } from '@/lib/payment/paymentMethodDefaults'

/**
 * App-wide horizontal colour picker — the payment-methods swatch row, globalised. Cards, pockets,
 * and anything user-colourable share this control and the {@link CARD_COLORS} palette. Stores a hex
 * string; consumers must render any hex (don't assume a fixed set).
 */
export interface ColorSwatchRowProps {
  value: string
  onChange: (hex: string) => void
  /** Override the palette (defaults to the shared CARD_COLORS). */
  colors?: readonly string[]
  className?: string
}

export function ColorSwatchRow({ value, onChange, colors = CARD_COLORS, className }: ColorSwatchRowProps) {
  return (
    <div className={`native-scroll flex gap-2.5 overflow-x-auto px-0.5 pb-1 ${className ?? ''}`}>
      {colors.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          aria-label={`Colour ${c}`}
          className="h-[34px] w-[34px] shrink-0 rounded-[10px]"
          style={{
            background: c,
            border: `2px solid ${value === c ? '#fff' : 'transparent'}`,
            boxShadow: '0 0 0 1px rgba(255,255,255,.12)',
          }}
        />
      ))}
    </div>
  )
}
