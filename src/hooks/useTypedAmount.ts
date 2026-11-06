import { useState } from 'react'
import { reconcileTyped } from '@/lib/ui/typedAmount'

/**
 * For an amount box whose number is stored as a `Number`: keeps the text being typed ("9.", "0.", "")
 * for as long as it still means the stored number, so a decimal point is not erased on the next render.
 * Returns the text to show and the setter to call from the box's onChange.
 */
export function useTypedAmount(stored: number, showZero = false): readonly [string, (typed: string) => void] {
  const [typed, setTyped] = useState(stored || showZero ? String(stored) : '')
  return [reconcileTyped(typed, stored), setTyped] as const
}
