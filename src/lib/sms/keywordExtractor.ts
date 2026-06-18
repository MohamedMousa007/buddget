/**
 * Extracts candidate transaction-vocabulary tokens from a confirmed-transaction
 * SMS so we can build a data-driven keyword pool (frequency-counted). The pool
 * later seeds the Phase-2 native keyword + sender allowlist, letting us shift the
 * on-device gate off the permissive business-sender model back to the narrower
 * keyword model without guessing the vocabulary.
 *
 * PII-safe: drops anything with digits (amounts, phone numbers, account masks,
 * references), URLs, and a small filler stoplist. Unique tokens (names) survive
 * at count 1 and are ignored when the pool is exported with a min-count threshold.
 */

const URL_RE = /https?:\/\/\S+|www\.\S+|\S+\.(?:com|net|org|eg|ae|sa)\b/gi

// English + Arabic filler that carries no transaction signal.
const STOPLIST = new Set<string>([
  // English
  'the', 'and', 'for', 'your', 'you', 'with', 'from', 'has', 'have', 'been',
  'this', 'that', 'was', 'were', 'are', 'will', 'can', 'all', 'any', 'now',
  'please', 'dear', 'customer', 'account', 'available', 'balance', 'card',
  'number', 'ref', 'reference', 'date', 'time', 'thank', 'thanks',
  // Arabic
  'من', 'في', 'على', 'الى', 'إلى', 'مع', 'هذا', 'هذه', 'تم', 'قد', 'كل',
  'رقم', 'بتاريخ', 'تاريخ', 'عميلنا', 'عزيزي', 'الحالي', 'رصيدك', 'رصيد',
  'حسابك', 'حساب', 'مبلغ', 'يرجى', 'العملية', 'المتاح',
])

export type TokenLang = 'ar' | 'en' | 'other'

export interface KeywordToken {
  keyword: string
  lang: TokenLang
}

function classify(token: string): TokenLang {
  if (/[؀-ۿ]/.test(token)) return 'ar'
  if (/[a-z]/i.test(token)) return 'en'
  return 'other'
}

/**
 * Returns de-duplicated candidate keyword tokens (lowercased for Latin).
 * Strips digits/URLs/punctuation; drops stoplist + tokens shorter than 3 chars
 * or containing any digit.
 */
export function extractKeywords(message: string): KeywordToken[] {
  if (!message) return []
  const cleaned = message.replace(URL_RE, ' ')
  // Split on whitespace + ASCII/Arabic punctuation; keep Arabic + Latin letters.
  const raw = cleaned.split(/[^\p{L}]+/u)
  const out = new Map<string, KeywordToken>()
  for (const t of raw) {
    if (!t || t.length < 3) continue
    if (/\d/.test(t)) continue
    const lang = classify(t)
    const key = lang === 'ar' ? t : t.toLowerCase()
    if (STOPLIST.has(key)) continue
    if (!out.has(key)) out.set(key, { keyword: key, lang })
  }
  return [...out.values()]
}
