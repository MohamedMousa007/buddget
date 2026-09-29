import type { ReactNode } from 'react'

/** Wraps each run of digits (with its , . : –) in `font-mono-numbers`: every figure in copy is mono. */
export function monoDigits(text: string): ReactNode[] {
  return text.split(/(\d[\d,.:–-]*)/).map((part, i) =>
    i % 2 ? (
      <span key={i} className="font-mono-numbers">
        {part}
      </span>
    ) : (
      part
    ),
  )
}
