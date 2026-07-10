import type { Currency } from '@/lib/store/types'

/** Flag + English name per supported currency (handoff §4 currency rows). */
export const CURRENCY_META: Record<string, { flag: string; name: string }> = {
  AED: { flag: '🇦🇪', name: 'UAE Dirham' },
  USD: { flag: '🇺🇸', name: 'US Dollar' },
  EGP: { flag: '🇪🇬', name: 'Egyptian Pound' },
  EUR: { flag: '🇪🇺', name: 'Euro' },
  GBP: { flag: '🇬🇧', name: 'Pound Sterling' },
  SAR: { flag: '🇸🇦', name: 'Saudi Riyal' },
  KWD: { flag: '🇰🇼', name: 'Kuwaiti Dinar' },
  QAR: { flag: '🇶🇦', name: 'Qatari Riyal' },
  BHD: { flag: '🇧🇭', name: 'Bahraini Dinar' },
  OMR: { flag: '🇴🇲', name: 'Omani Rial' },
  MAD: { flag: '🇲🇦', name: 'Moroccan Dirham' },
  TND: { flag: '🇹🇳', name: 'Tunisian Dinar' },
  JOD: { flag: '🇯🇴', name: 'Jordanian Dinar' },
  XAU: { flag: '🥇', name: 'Gold (per gram)' },
}

export function currencyFlag(code: string): string {
  return CURRENCY_META[code]?.flag ?? '🏳️'
}

export function currencyName(code: string): string {
  return CURRENCY_META[code]?.name ?? code
}

/** Common codes pinned at the top of the currency sheet (base is prepended by the sheet). */
export const COMMON_CURRENCIES: Currency[] = ['AED', 'USD', 'EGP', 'EUR', 'GBP', 'SAR']
