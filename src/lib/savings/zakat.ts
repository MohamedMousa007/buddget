/**
 * Zakat (guidance, never a ruling) — the majority (jumhūr) position, implemented exactly as the
 * v3 spec pins it down. Every line is the live figure; the only typed inputs are what the app cannot know
 * (worn jewellery, doubtful receivables, trade goods). This is the pure math.
 *
 *   zakatable = cash&savings + gold + crypto + stocks×factor + receivables + trade goods − debtsDueThisYear   (floored at 0)
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
  /** Money owed to the user that is likely to be repaid. */
  receivables: number
  /** Goods held for trade, typed by the user. */
  tradeGoodsValue: number
  holdsForTrading: boolean
  debtsDueThisYear: number
  nisabBasis: 'silver' | 'gold'
  gold24kSellPerGram: number
  silverPerGram: number
}

export interface ZakatResult {
  zakatable: number
  nisab: number
  /** False when the price feed is missing, so no nisab line can be drawn and nothing is "due". */
  nisabAvailable: boolean
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
      input.stocksValue * stockFactor +
      input.receivables +
      input.tradeGoodsValue -
      input.debtsDueThisYear,
  )

  const nisab =
    input.nisabBasis === 'gold'
      ? 85 * input.gold24kSellPerGram
      : 595 * input.silverPerGram

  const nisabAvailable = nisab > 0
  const due = nisabAvailable && zakatable >= nisab

  return {
    zakatable,
    nisab,
    nisabAvailable,
    due,
    zakat: due ? zakatable * 0.025 : 0,
    gap: due || !nisabAvailable ? 0 : Math.max(0, nisab - zakatable),
  }
}
