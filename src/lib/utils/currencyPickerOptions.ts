import { FIAT_CURRENCIES, DEBT_FIAT_CURRENCIES } from '@/lib/constants/finance'
import type { AppSettings, Currency, DebtCurrency } from '@/lib/store/types'

export type FiatPickerOption = { value: Currency; disabled: boolean }

/** Reads legacy `currencyDropdownScope` from persisted JSON when `showAllCurrenciesInForms` is absent. */
function effectiveShowAllCurrenciesInForms(settings: AppSettings): boolean {
  if (typeof settings.showAllCurrenciesInForms === 'boolean') {
    return settings.showAllCurrenciesInForms
  }
  const legacy = settings as AppSettings & {
    currencyDropdownScope?: 'all' | 'primary_only' | 'primary_and_secondary'
  }
  return legacy.currencyDropdownScope === 'all'
}

export function buildFiatCurrencyPickerOptions(settings: AppSettings): FiatPickerOption[] {
  const showAll = effectiveShowAllCurrenciesInForms(settings)

  if (showAll) {
    return FIAT_CURRENCIES.map((c) => ({ value: c, disabled: false }))
  }

  const allowed = new Set<Currency>()
  allowed.add(settings.baseCurrency)
  if (settings.secondaryCurrency && settings.showSecondaryCurrency) {
    allowed.add(settings.secondaryCurrency)
  }

  return [...allowed].map((c) => ({ value: c, disabled: false }))
}

export type DebtFiatPickerOption = { value: DebtCurrency; disabled: boolean }

const DEBT_FIAT_ORDER = DEBT_FIAT_CURRENCIES.filter((c) => c !== 'XAU') as Currency[]

/** Fiat options for debt (non-gold); same rules as `buildFiatCurrencyPickerOptions`. */
export function buildDebtFiatPickerOptions(settings: AppSettings): DebtFiatPickerOption[] {
  const fiatOpts = buildFiatCurrencyPickerOptions(settings)
  const byValue = new Map(fiatOpts.map((o) => [o.value, o]))
  const orderIdx = new Map(DEBT_FIAT_ORDER.map((c, i) => [c, i]))

  if (effectiveShowAllCurrenciesInForms(settings)) {
    return DEBT_FIAT_ORDER.map((c) => ({
      value: c as DebtCurrency,
      disabled: byValue.get(c)?.disabled ?? false,
    }))
  }

  return [...fiatOpts]
    .filter((o) => DEBT_FIAT_ORDER.includes(o.value))
    .sort((a, b) => (orderIdx.get(a.value) ?? 0) - (orderIdx.get(b.value) ?? 0))
    .map((o) => ({ value: o.value as DebtCurrency, disabled: false }))
}

export function clampFiatToAllowed(settings: AppSettings, currency: Currency): Currency {
  const opts = buildFiatCurrencyPickerOptions(settings)
  const pick = opts.find((o) => o.value === currency && !o.disabled)
  if (pick) return pick.value
  return settings.baseCurrency
}

export function clampDebtFiatToAllowed(settings: AppSettings, currency: DebtCurrency): DebtCurrency {
  if (currency === 'XAU') return 'XAU'
  const opts = buildDebtFiatPickerOptions(settings)
  const pick = opts.find((o) => o.value === currency && !o.disabled)
  if (pick) return pick.value
  return settings.baseCurrency as DebtCurrency
}
