/** Display metadata for supported fiat codes in the settings converter. */
export const CURRENCY_INFO: Record<string, { flag: string; name: string }> = {
  AED: { flag: '🇦🇪', name: 'UAE Dirham' },
  USD: { flag: '🇺🇸', name: 'US Dollar' },
  EGP: { flag: '🇪🇬', name: 'Egyptian Pound' },
  EUR: { flag: '🇪🇺', name: 'Euro' },
  GBP: { flag: '🇬🇧', name: 'British Pound' },
  SAR: { flag: '🇸🇦', name: 'Saudi Riyal' },
  KWD: { flag: '🇰🇼', name: 'Kuwaiti Dinar' },
  QAR: { flag: '🇶🇦', name: 'Qatari Riyal' },
  BHD: { flag: '🇧🇭', name: 'Bahraini Dinar' },
  OMR: { flag: '🇴🇲', name: 'Omani Rial' },
  MAD: { flag: '🇲🇦', name: 'Moroccan Dirham' },
  TND: { flag: '🇹🇳', name: 'Tunisian Dinar' },
  JOD: { flag: '🇯🇴', name: 'Jordanian Dinar' },
}

export const CONVERTER_CODES = [
  'AED',
  'USD',
  'EGP',
  'EUR',
  'GBP',
  'SAR',
  'KWD',
  'QAR',
  'BHD',
  'OMR',
  'MAD',
  'TND',
  'JOD',
] as const
