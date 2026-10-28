import { parseLocalizedAmount } from '@/lib/ui/amountParse'

/** Reads a typed zakat figure (grouped or Arabic-Indic digits); null when empty or unreadable, never 0. */
export function parseZakatLine(raw: string): number | null {
  if (raw.trim() === '') return null
  const n = parseLocalizedAmount(raw)
  return Number.isFinite(n) ? n : null
}

export type LineEdit = { kind: 'keep' } | { kind: 'clear' } | { kind: 'set'; value: number }

/**
 * What leaving a zakat line field does. Text that still rounds to the live figure is not an
 * edit (so tabbing through never freezes a live value); an empty field drops the override.
 */
export function resolveLineEdit(raw: string, live: number, override: number | undefined): LineEdit {
  if (raw.trim() === '') return { kind: 'clear' }
  const value = parseZakatLine(raw)
  if (value == null) return { kind: 'keep' }
  if (override == null && Math.round(live) === value) return { kind: 'keep' }
  return { kind: 'set', value }
}
