import { goldGramsToMoney, moneyToGoldGrams } from '@/lib/utils/calculations'
import { convertCurrency } from '@/lib/utils/currency'
import type { GoldKarat } from '@/lib/store/types'

/** What the amount was before gold-backed was switched on, so switching it off again gives the typed figure back. */
export interface GoldSwitchMemo {
  grams: string
  money: string
  currency: string
}

export interface GoldSwitchCtx {
  /** Today's 24k price per gram, in `base`. */
  pricePerGram24k: number
  priceAvailable: boolean
  karat: GoldKarat
  base: string
  rates: Record<string, number>
}

export interface GoldSwitchResult {
  amount: string
  currency: string
  memo: GoldSwitchMemo | null
  /** True when the amount could not be converted (no live gold price) and was cleared instead. */
  cleared: boolean
}

const round = (n: number, digits: number) => String(Math.round(n * 10 ** digits) / 10 ** digits)

/**
 * The borrow amount after gold-backed is switched: money becomes grams of `karat` at today's price, grams become
 * money in the base currency. Switching back untouched restores the figure the user typed. With no live price the
 * amount is cleared, never silently set to 0.
 */
export function switchBorrowGold(
  input: { amount: string; currency: string; toGold: boolean; memo: GoldSwitchMemo | null },
  ctx: GoldSwitchCtx,
): GoldSwitchResult {
  const { amount, toGold, memo } = input
  const currency = toGold ? 'XAU' : ctx.base
  if (!toGold && memo && memo.grams === amount) return { amount: memo.money, currency: memo.currency, memo: null, cleared: false }
  const value = Number.parseFloat(amount)
  if (!amount || !Number.isFinite(value) || value <= 0) return { amount, currency, memo: null, cleared: false }
  if (!ctx.priceAvailable || ctx.pricePerGram24k <= 0) return { amount: '', currency, memo: null, cleared: true }
  if (toGold) {
    const grams = round(moneyToGoldGrams(convertCurrency(value, input.currency, ctx.base, ctx.rates), ctx.pricePerGram24k, ctx.karat), 3)
    return { amount: grams, currency, memo: { grams, money: amount, currency: input.currency }, cleared: false }
  }
  return { amount: round(goldGramsToMoney(value, ctx.pricePerGram24k, ctx.karat), 2), currency, memo: null, cleared: false }
}
