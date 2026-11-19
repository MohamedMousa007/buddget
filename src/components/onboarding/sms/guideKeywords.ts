/**
 * Keywords for the iOS "Message Contains" automation, one automation each, best first. Egypt and Saudi are measured on
 * 809 booked bank texts: Egyptian banks write "EGP" or "جم" (CIB, NBE), Vodafone Cash writes "جنيه"; Saudi banks write
 * "SAR" or "SR". The Gulf and USD entries are the usual spellings, not yet measured against our own texts.
 * Currencies not listed fall back to the ISO code.
 */
const BY_CURRENCY: Record<string, string[]> = {
  EGP: ['EGP', 'جم', 'جنيه'],
  SAR: ['SAR', 'SR', 'ريال'],
  AED: ['AED', 'درهم'],
  KWD: ['KWD', 'دينار'],
  QAR: ['QAR', 'ريال'],
  USD: ['USD', 'دولار'],
}

/** Spellings some banks use instead, per currency, offered as taps in the guide (not as automatic rounds). */
const ALSO_BY_CURRENCY: Record<string, string[]> = {
  EGP: ['LE', 'L.E', 'E£'],
  SAR: ['ر.س'],
  AED: ['د.إ'],
}

/** Words a bank text often carries whatever the currency. */
const GENERIC = ['USD', 'دولار', 'charged', 'debited', 'purchase', 'خصم', 'شراء', 'عملية']

export function guideKeywords(currency: string): string[] {
  return BY_CURRENCY[currency] ?? [currency]
}

/** Every word worth offering: the rounds first, then the other spellings and generic words, no repeats. */
export function allGuideKeywords(currency: string): string[] {
  return [...new Set([...guideKeywords(currency), ...(ALSO_BY_CURRENCY[currency] ?? []), ...GENERIC])]
}
