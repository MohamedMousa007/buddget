/** `#RRGGBB` (or `RRGGBB`) + alpha → `rgba(r,g,b,a)`. */
export function rgba(hex: string, a: number): string {
  const h = hex.replace('#', '')
  return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a})`
}
