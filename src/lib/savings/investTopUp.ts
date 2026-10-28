import type { InvestmentHolding } from '@/lib/store/types'
import { convertCurrency } from '@/lib/utils/currency'

const UNIT_PRECISION = 1e6

/** Holding fields after buying `qtyAdd` more units for `amount`: quantity up, cost basis blended so returns stay honest. */
export function investTopUpPatch(
  holding: Pick<InvestmentHolding, 'quantity' | 'unitCost' | 'costBasisCurrency' | 'currency'>,
  qtyAdd: number,
  amount: number,
  amountCurrency: string,
  rates: Record<string, number>,
): Pick<InvestmentHolding, 'quantity' | 'unitCost' | 'costBasisCurrency'> {
  const quantity = Math.round((holding.quantity + qtyAdd) * UNIT_PRECISION) / UNIT_PRECISION
  const costCurrency = holding.costBasisCurrency ?? holding.currency
  const paid = convertCurrency(amount, amountCurrency, costCurrency, rates)
  if (holding.quantity <= 0) return { quantity, unitCost: paid / qtyAdd, costBasisCurrency: costCurrency }
  if (holding.unitCost == null) return { quantity }
  return { quantity, unitCost: (holding.quantity * holding.unitCost + paid) / quantity, costBasisCurrency: costCurrency }
}
