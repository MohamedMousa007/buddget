/**
 * Keywords for the iOS "Message Contains" automation, one automation each, best first. Measured on 809 booked bank texts:
 * Egyptian banks write "EGP" (English) or "جم" (Arabic: CIB, NBE), Vodafone Cash writes "جنيه"; together they cover every
 * Egyptian text in the sample. Saudi banks write "SAR" or "SR". Other currencies fall back to the ISO code.
 */
const BY_CURRENCY: Record<string, string[]> = {
  EGP: ['EGP', 'جم', 'جنيه'],
  SAR: ['SAR', 'SR'],
}

export function guideKeywords(currency: string): string[] {
  return BY_CURRENCY[currency] ?? [currency]
}
