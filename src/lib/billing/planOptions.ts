import type { PurchasesPackage } from '@revenuecat/purchases-capacitor'

export interface PlanOption {
  pkg: PurchasesPackage
  kind: 'annual' | 'monthly'
  /** The amount charged each period, straight from the store. */
  price: string
  /** Annual only: the monthly equivalent, as smaller secondary text. */
  perMonth: string | null
}

const KIND: Record<string, 'annual' | 'monthly'> = { ANNUAL: 'annual', MONTHLY: 'monthly' }

/** Annual first. The main price is the amount actually charged for the period (the yearly amount for annual). */
export function buildPlanOptions(packages: readonly PurchasesPackage[]): PlanOption[] {
  const options: PlanOption[] = []
  for (const pkg of packages) {
    const kind = KIND[String(pkg.packageType)]
    if (!kind) continue
    options.push({ pkg, kind, price: pkg.product.priceString, perMonth: kind === 'annual' ? pkg.product.pricePerMonthString ?? null : null })
  }
  return options.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'annual' ? -1 : 1))
}
