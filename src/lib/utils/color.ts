/** `#RRGGBB` (or `RRGGBB`) + alpha → `rgba(r,g,b,a)`. */
export function rgba(hex: string, a: number): string {
  const h = hex.replace('#', '')
  return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a})`
}

/** Any CSS colour (a token, `var(--x)`, `black`, a hex) at `pct` percent opacity, resolved by the browser so it follows the theme. */
export function mix(color: string, pct: number): string {
  return `color-mix(in oklab, ${color} ${pct}%, transparent)`
}

/** `#RRGGBB` (or `RRGGBB`) brightness-scaled by `f` (>1 lightens, <1 darkens), clamped to a valid channel. */
export function shade(hex: string, f: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16)
  const m = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)))
  return `rgb(${m(r)},${m(g)},${m(b)})`
}

/**
 * A data-driven brand colour pulled toward the text colour so it stays legible as small text, a fill or a glyph on the
 * card in both themes (a near-black brand tile would vanish in dark; a mid-tone category colour fails AA as 9px text).
 */
export function readable(color: string): string {
  return `color-mix(in oklab, ${color} 70%, var(--color-brand-text-primary))`
}
