const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩'
const EASTERN_ARABIC_INDIC = '۰۱۲۳۴۵۶۷۸۹'

const FOLD: Record<string, string> = {
  أ: '[أإآاٱ]',
  إ: '[أإآاٱ]',
  آ: '[أإآاٱ]',
  ا: '[أإآاٱ]',
  ٱ: '[أإآاٱ]',
  ة: '[ةه]',
  ه: '[ةه]',
  ى: '[ىي]',
  ي: '[ىي]',
}

export function normalizeText(text: string): string {
  return text
    .replace(/[٠-٩۰-۹]/g, (ch) => {
      const i = ARABIC_INDIC.indexOf(ch)
      return String(i >= 0 ? i : EASTERN_ARABIC_INDIC.indexOf(ch))
    })
    .replace(/٫/g, '.')
    .replace(/٬/g, ',')
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function foldArabic(source: string): string {
  return source.replace(/[أإآاٱةهىي]/g, (ch) => FOLD[ch])
}

/** Case-insensitive whole-word regex; Arabic letter variants (alef/ya/ta marbuta) are interchangeable. */
export function wordRe(source: string): RegExp {
  return new RegExp(`(?<![\\p{L}\\d])(?:${foldArabic(source)})(?![\\p{L}\\d])`, 'iu')
}

export function stripAll(text: string, re: RegExp): string {
  return text.replace(new RegExp(re.source, 'giu'), ' ')
}

export function escapeRe(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
