'use client'

import { CARD_THEMES, CARD_THEME_KEYS, type CardThemeKey } from '@/lib/payment/cardThemes'

interface Props {
  value: CardThemeKey
  onChange: (k: CardThemeKey) => void
  names: Record<CardThemeKey, string>
  ariaLabel: string
}

/** The 16 card themes as gradient dots, 8 to a row, each on a 44px tap target; the chosen one wears the primary ring. */
export function CardThemePicker({ value, onChange, names, ariaLabel }: Props) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="grid grid-cols-8 justify-items-center gap-y-2">
      {CARD_THEME_KEYS.map((k) => {
        const on = k === value
        const th = CARD_THEMES[k]
        return (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={names[k]}
            onClick={() => onChange(k)}
            className="grid place-items-center p-[5px] outline-none focus-visible:rounded-full focus-visible:ring-2 focus-visible:ring-[var(--color-brand-focus)]"
          >
            <span
              aria-hidden
              className="box-border block size-[34px] rounded-full"
              style={{
                background: `linear-gradient(135deg, ${th.a}, ${th.b})`,
                border: '1px solid rgba(4,32,28,.12)',
                boxShadow: on ? '0 0 0 2px var(--color-brand-card), 0 0 0 4px var(--color-brand-primary)' : 'none',
              }}
            />
          </button>
        )
      })}
    </div>
  )
}
