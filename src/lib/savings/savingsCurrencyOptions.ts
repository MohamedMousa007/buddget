import type { AppSettings, Currency } from '@/lib/store/types'
import { buildFiatCurrencyPickerOptions } from '@/lib/utils/currencyPickerOptions'
import type { SavingsType } from '@/lib/store/types'

export type SavingsCurrencyOption = { value: Currency; label: string }

/**
 * Currency choices for new savings, based on product type (gold grams, crypto units, etc.).
 */
export function buildSavingsCurrencyOptions(
  settings: AppSettings,
  savingsType: SavingsType
): SavingsCurrencyOption[] {
  const fiat = buildFiatCurrencyPickerOptions(settings)
    .filter((o) => !o.disabled)
    .map((o) => ({ value: o.value, label: o.value }))

  const uniq = (opts: SavingsCurrencyOption[]): SavingsCurrencyOption[] => {
    const seen = new Set<string>()
    const out: SavingsCurrencyOption[] = []
    for (const o of opts) {
      if (seen.has(o.value)) continue
      seen.add(o.value)
      out.push(o)
    }
    return out
  }

  switch (savingsType) {
    case 'gold':
      return uniq([{ value: 'XAU', label: 'XAU (g)' }, ...fiat])
    case 'crypto_stable':
      return uniq([
        { value: 'USDT', label: 'USDT' },
        { value: 'USDC', label: 'USDC' },
        ...fiat,
      ])
    case 'crypto':
      return uniq([
        { value: 'BTC', label: 'BTC' },
        { value: 'ETH', label: 'ETH' },
        { value: 'USDT', label: 'USDT' },
        { value: 'USDC', label: 'USDC' },
        ...fiat,
      ])
    default:
      return fiat
  }
}

export function pickDefaultSavingsCurrency(settings: AppSettings, savingsType: SavingsType): Currency {
  const opts = buildSavingsCurrencyOptions(settings, savingsType)
  return opts[0]?.value ?? settings.baseCurrency
}
