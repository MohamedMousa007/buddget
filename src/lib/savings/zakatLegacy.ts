import type { ZakatConfig } from '@/lib/store/types'
import { computeZakat } from '@/lib/savings/zakat'
import { toZakatInput, type ZakatBase } from '@/lib/savings/zakatInputs'

/** Hand-typed figures older configs may still carry in `profiles.zakat_config`. Read here only; never computed with. */
export interface LegacyZakatFields {
  manualAmount?: number | null
  lineOverrides?: Record<string, number>
}

export type StoredZakatConfig = ZakatConfig & LegacyZakatFields

const LINE_KEYS = { cash: 'cashAndSavings', gold: 'goldValue', crypto: 'cryptoValue', stocks: 'stocksValue', debts: 'debtsDueThisYear' } as const

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)

export function hasLegacyZakat(cfg: ZakatConfig | null | undefined): boolean {
  const c = cfg as StoredZakatConfig | null | undefined
  return finite(c?.manualAmount) || Object.values(c?.lineOverrides ?? {}).some(finite)
}

/** The zakat figure the old config produced (its typed total, else the live lines with its edits), for the one-time note. */
export function legacyZakatFigure(cfg: ZakatConfig | null | undefined, base: ZakatBase): number | null {
  if (!hasLegacyZakat(cfg)) return null
  const c = cfg as StoredZakatConfig
  if (finite(c.manualAmount)) return Math.max(0, c.manualAmount)
  const old = { ...base }
  for (const [key, field] of Object.entries(LINE_KEYS)) {
    const v = c.lineOverrides?.[key]
    if (finite(v)) old[field] = v
  }
  return computeZakat({ ...toZakatInput(old, c), receivables: 0, tradeGoodsValue: 0 }).zakat
}

/** `cfg` without the old hand-typed figures: what dismissing the note saves. */
export function withoutLegacyZakat(cfg: ZakatConfig): ZakatConfig {
  const rest: StoredZakatConfig = { ...cfg }
  delete rest.manualAmount
  delete rest.lineOverrides
  return rest
}
