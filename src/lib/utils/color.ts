/** `#RRGGBB` (or `RRGGBB`) + alpha → `rgba(r,g,b,a)`. */
export function rgba(hex: string, a: number): string {
  const h = hex.replace('#', '')
  return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a})`
}

/** `#RRGGBB` (or `RRGGBB`) brightness-scaled by `f` (>1 lightens, <1 darkens), clamped to a valid channel. */
export function shade(hex: string, f: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16)
  const m = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)))
  return `rgb(${m(r)},${m(g)},${m(b)})`
}
