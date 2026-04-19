import { cn } from '@/lib/utils'

export interface SarSymbolProps {
  className?: string
  title?: string
}

/**
 * Saudi Riyal mark — a calligraphic "ريال" hook resting on the two-bar
 * currency convention. The Unicode codepoint (U+20C0) exists but font
 * support is patchy on Windows / older macOS so we ship a vector form
 * that's guaranteed to render pixel-sharp at any size. Inherits text
 * colour via `currentColor`.
 */
export function SarSymbol({ className, title = 'Saudi Riyal' }: SarSymbolProps) {
  return (
    <svg
      viewBox="0 0 140 160"
      role="img"
      aria-label={title}
      className={cn('inline-block align-[-0.15em]', className)}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Main calligraphic hook — top horizontal, curving down through centre. */}
      <path
        d="M 30 32 L 100 32 Q 112 32 112 50 Q 112 82 82 96 Q 55 108 36 96"
        strokeWidth="9"
      />
      {/* Short vertical tail echoing the ي dot column */}
      <path d="M 30 52 L 30 84" strokeWidth="9" />
      {/* Two horizontal currency bars */}
      <line x1="26" y1="128" x2="114" y2="128" strokeWidth="6" />
      <line x1="26" y1="144" x2="114" y2="144" strokeWidth="6" />
    </svg>
  )
}
