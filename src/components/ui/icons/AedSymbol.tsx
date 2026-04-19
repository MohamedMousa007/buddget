import { cn } from '@/lib/utils'

export interface AedSymbolProps {
  className?: string
  title?: string
}

/**
 * March-2025 UAE Dirham sign, rendered as inline SVG because Unicode
 * font support for the new codepoint is still sparse. Vector design:
 * Latin letter `D` with two horizontal bands running through it —
 * the horizontal bands echo the UAE flag. Uses `currentColor` so the
 * glyph inherits its surrounding text colour (and picks up any dark-
 * theme / hero-colour styling automatically).
 */
export function AedSymbol({ className, title = 'AED' }: AedSymbolProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      role="img"
      aria-label={title}
      className={cn('inline-block align-[-0.1em]', className)}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Letter D: left vertical + top / bottom arcs meeting on the right */}
      <path
        d="M 18 10 L 18 54 L 34 54 C 52 54 54 42 54 32 C 54 22 52 10 34 10 Z"
        strokeWidth="6"
      />
      {/* Two horizontal bands threading through the D */}
      <path d="M 8 26 L 60 26" strokeWidth="5" />
      <path d="M 8 42 L 60 42" strokeWidth="5" />
    </svg>
  )
}
