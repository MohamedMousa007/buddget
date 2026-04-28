import type { V2FixedBill } from '@/lib/onboarding/v2/commitV2Step'

const FIXED_LABELS: Record<V2FixedBill['key'], string> = {
  rent: 'Rent',
  dewa: 'DEWA',
  internet: 'Internet',
}

export interface FixedCostLine {
  label: string
  amount: number
}

/**
 * Enabled V2 fixed bill rows from onboarding answers (amounts in user’s base currency).
 * Optional `extras` is `answers.stepper_fixed_extra`: free-form lines from the page stepper.
 */
export function listEnabledV2FixedCosts(raw: unknown, extras?: unknown): FixedCostLine[] {
  const out: FixedCostLine[] = []
  if (Array.isArray(raw)) {
    for (const row of raw as V2FixedBill[]) {
      if (!row || typeof row !== 'object') continue
      if (!row.enabled) continue
      const n = parseFloat(String(row.amount).replace(/,/g, '.'))
      if (!Number.isFinite(n) || n <= 0) continue
      const key = row.key
      if (key !== 'rent' && key !== 'dewa' && key !== 'internet') continue
      out.push({ label: FIXED_LABELS[key], amount: n })
    }
  }
  if (Array.isArray(extras)) {
    for (const row of extras as { name?: unknown; amount?: unknown }[]) {
      if (!row || typeof row !== 'object') continue
      const label = typeof row.name === 'string' && row.name.trim() ? row.name.trim() : 'Fixed'
      const n = parseFloat(String(row.amount).replace(/,/g, '.'))
      if (!Number.isFinite(n) || n <= 0) continue
      out.push({ label, amount: n })
    }
  }
  return out
}
