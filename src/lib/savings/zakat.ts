/**
 * Zakat (guidance, never a ruling) — the majority (jumhūr) position, implemented exactly as the
 * v3 spec pins it down. Every input is user-overridable in the sheet; this is the pure math.
 *
 *   zakatable = cash&savings + gold + crypto + stocks×factor − debtsDueThisYear   (floored at 0)
 *   factor    = 0.30 long-term  |  1.00 for trading
 *   nisab     = silver: 595g × silver/g  (DEFAULT, the lower line)  |  gold: 85g × 24k sell/g
 *   due       = zakatable ≥ nisab && zakatable > 0  →  zakat = zakatable × 2.5%
 *
 * Property principal is NEVER included — only rent the user kept, which already sits in cash.
 */

export interface ZakatInput {
  cashAndSavings: number
  goldValue: number // at today's SELL price
  cryptoValue: number // at the parallel/Sagha rate
  stocksValue: number
  holdsForTrading: boolean
  debtsDueThisYear: number
  nisabBasis: 'silver' | 'gold'
  gold24kSellPerGram: number
  silverPerGram: number
  /** When set, replaces the computed zakat entirely (the "set the amount myself" switch). */
  manualAmount?: number | null
}

export interface ZakatResult {
  zakatable: number
  nisab: number
  due: boolean
  zakat: number
  /** How far below nisab, when not due (0 otherwise). */
  gap: number
}

export function computeZakat(input: ZakatInput): ZakatResult {
  const stockFactor = input.holdsForTrading ? 1 : 0.3

  const zakatable = Math.max(
    0,
    input.cashAndSavings +
      input.goldValue +
      input.cryptoValue +
      input.stocksValue * stockFactor -
      input.debtsDueThisYear,
  )

  const nisab =
    input.nisabBasis === 'gold'
      ? 85 * input.gold24kSellPerGram
      : 595 * input.silverPerGram

  const due = zakatable >= nisab && zakatable > 0
  const computed = due ? zakatable * 0.025 : 0

  const hasManual = input.manualAmount != null && Number.isFinite(input.manualAmount)
  const zakat = hasManual ? Math.max(0, input.manualAmount as number) : computed

  return {
    zakatable,
    nisab,
    due: hasManual ? (input.manualAmount as number) > 0 : due,
    zakat,
    gap: due ? 0 : Math.max(0, nisab - zakatable),
  }
}
