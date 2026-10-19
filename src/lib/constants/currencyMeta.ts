import type { Currency } from '@/lib/store/types'

/** Flag + English name + symbol per supported currency (handoff §4 currency rows). */
export const CURRENCY_META: Record<string, { flag: string; name: string; symbol: string; symbolAr?: string; nameAr?: string }> = {
  AED: { flag: '🇦🇪', name: 'UAE Dirham', symbol: 'AED', symbolAr: 'د.إ', nameAr: 'الدرهم الإماراتي' },
  USD: { flag: '🇺🇸', name: 'US Dollar', symbol: '$', symbolAr: '$', nameAr: 'الدولار الأمريكي' },
  EGP: { flag: '🇪🇬', name: 'Egyptian Pound', symbol: 'E£', symbolAr: 'ج.م', nameAr: 'الجنيه المصري' },
  EUR: { flag: '🇪🇺', name: 'Euro', symbol: '€', symbolAr: '€', nameAr: 'اليورو' },
  GBP: { flag: '🇬🇧', name: 'Pound Sterling', symbol: '£', symbolAr: '£', nameAr: 'الجنيه الإسترليني' },
  SAR: { flag: '🇸🇦', name: 'Saudi Riyal', symbol: 'SAR', symbolAr: 'ر.س', nameAr: 'الريال السعودي' },
  KWD: { flag: '🇰🇼', name: 'Kuwaiti Dinar', symbol: 'KD', symbolAr: 'د.ك', nameAr: 'الدينار الكويتي' },
  QAR: { flag: '🇶🇦', name: 'Qatari Riyal', symbol: 'QR', symbolAr: 'ر.ق', nameAr: 'الريال القطري' },
  BHD: { flag: '🇧🇭', name: 'Bahraini Dinar', symbol: 'BD', symbolAr: 'د.ب', nameAr: 'الدينار البحريني' },
  OMR: { flag: '🇴🇲', name: 'Omani Rial', symbol: 'RO', symbolAr: 'ر.ع', nameAr: 'الريال العماني' },
  MAD: { flag: '🇲🇦', name: 'Moroccan Dirham', symbol: 'DH', symbolAr: 'د.م', nameAr: 'الدرهم المغربي' },
  TND: { flag: '🇹🇳', name: 'Tunisian Dinar', symbol: 'DT', symbolAr: 'د.ت', nameAr: 'الدينار التونسي' },
  JOD: { flag: '🇯🇴', name: 'Jordanian Dinar', symbol: 'JD', symbolAr: 'د.أ', nameAr: 'الدينار الأردني' },
  XAU: { flag: '🥇', name: 'Gold (per gram)', symbol: 'Au', symbolAr: 'Au', nameAr: 'ذهب (للجرام)' },
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
