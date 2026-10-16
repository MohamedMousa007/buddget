import type { Currency } from '@/lib/store/types'

/** Flag + English name + symbol per supported currency (handoff §4 currency rows). */
export const CURRENCY_META: Record<string, { flag: string; name: string; symbol: string }> = {
  AED: { flag: '🇦🇪', name: 'UAE Dirham', symbol: 'AED' },
  USD: { flag: '🇺🇸', name: 'US Dollar', symbol: '$' },
  EGP: { flag: '🇪🇬', name: 'Egyptian Pound', symbol: 'E£' },
  EUR: { flag: '🇪🇺', name: 'Euro', symbol: '€' },
  GBP: { flag: '🇬🇧', name: 'Pound Sterling', symbol: '£' },
  SAR: { flag: '🇸🇦', name: 'Saudi Riyal', symbol: 'SAR' },
  KWD: { flag: '🇰🇼', name: 'Kuwaiti Dinar', symbol: 'KWD' },
  QAR: { flag: '🇶🇦', name: 'Qatari Riyal', symbol: 'QAR' },
  BHD: { flag: '🇧🇭', name: 'Bahraini Dinar', symbol: 'BHD' },
  OMR: { flag: '🇴🇲', name: 'Omani Rial', symbol: 'OMR' },
  MAD: { flag: '🇲🇦', name: 'Moroccan Dirham', symbol: 'MAD' },
  TND: { flag: '🇹🇳', name: 'Tunisian Dinar', symbol: 'TND' },
  JOD: { flag: '🇯🇴', name: 'Jordanian Dinar', symbol: 'JOD' },
  XAU: { flag: '🥇', name: 'Gold (per gram)', symbol: 'Au' },
}

export function currencyFlag(code: string): string {
  return CURRENCY_META[code]?.flag ?? '🏳️'
}

export function currencySymbol(code: string): string {
  return CURRENCY_META[code]?.symbol ?? code
}

export function currencyName(code: string): string {
  return CURRENCY_META[code]?.name ?? code
}

/** Common codes pinned at the top of the currency sheet (base is prepended by the sheet). */
export const COMMON_CURRENCIES: Currency[] = ['AED', 'USD', 'EGP', 'EUR', 'GBP', 'SAR']
