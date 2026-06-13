/**
 * Shared currency + transaction-keyword vocabulary for the SMS pipeline.
 *
 * Covers Egypt (EGP) and the GCC/Arab markets (SAR, AED, KWD, QAR, OMR, BHD) in
 * both English ISO codes and the Arabic words/symbols banks actually print. Used
 * by the pre-filter (so Gulf transactions aren't mis-rejected) and available to
 * any structural extractor that needs to recognize a currency or a money verb.
 */

/** ISO codes seen in Egyptian + Gulf bank SMS (plus common foreign codes). */
export const CURRENCY_CODES = [
  'EGP', 'SAR', 'AED', 'KWD', 'QAR', 'OMR', 'BHD', 'USD', 'EUR', 'GBP',
] as const

/**
 * Any currency token: ISO code (EGP/SAR/AED/…), the colloquial `LE`, or an
 * Arabic currency word/symbol — جنيه/جم (EGP), ريال/ر.س (SAR), درهم/د.إ (AED),
 * دينار/د.ك (KWD), ر.ق (QAR), ر.ع (OMR), د.ب (BHD).
 */
export const CURRENCY_TOKEN_RE =
  /\b(?:EGP|SAR|AED|KWD|QAR|OMR|BHD|USD|EUR|GBP|LE)\b|جني[هة]|جم|ريال|درهم|دينار|ر\.?\s?س|د\.?\s?إ|د\.?\s?ك|ر\.?\s?ق|ر\.?\s?ع|د\.?\s?ب/i

/**
 * Strong transaction-action keywords (EN + AR), Egypt + Gulf. "Strong" = the
 * presence of one means a real money movement, so the pre-filter treats these
 * as an override that bypasses marketing/balance rejection. Deliberately
 * excludes weak nouns like "amount"/"مبلغ" that also appear in ads.
 */
export const TXN_KEYWORD_RE =
  /(?:debit(?:ed)?|credit(?:ed)?|withdraw(?:n|al)?|charged|spent\s+at|purchase\s+(?:of|at)|pos\s+purchase|atm\s+(?:withdrawal|cash)|transfer(?:red)?|phone\s+banking|payment\s+(?:of|received)|received\s+from|paid\s+to|تم\s*خصم|تم\s*سحب|تم\s*دفع|تم\s*إيداع|تم\s*استلام|تم\s*تحويل|تم\s*إضافة|عملية\s*شراء|سحب\s*نقدي|نقاط\s*بيع)/i

/** True when the text contains any recognized currency token. */
export function hasCurrencyToken(text: string): boolean {
  return CURRENCY_TOKEN_RE.test(text)
}
