import type { Currency } from '@/lib/store/types'

/** Overdraw tolerance for crypto and gold pockets, where 0.001 would be a real amount (0.001 BTC). */
export const BALANCE_EPSILON = 1e-9

const MONEY_EPSILON = 0.001
const NON_MONEY: ReadonlySet<string> = new Set<Currency>(['BTC', 'ETH', 'XAU'])

/** Tolerance for "enough in the pocket": a fraction of a cent for money, 1e-9 for crypto and gold. */
export const balanceEpsilon = (currency: Currency): number => (NON_MONEY.has(currency) ? BALANCE_EPSILON : MONEY_EPSILON)

/** Balances are float sums: settle them at 12 decimals so 0.1 + 0.2 is 0.3 and 0.00000001 BTC survives; never returns -0. */
export const settleBalance = (n: number): number => Math.round(n * 1e12) / 1e12 + 0
