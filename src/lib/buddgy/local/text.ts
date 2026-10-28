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

/**
 * Whole-word regex without lookbehind (Safari < 16.4 rejects it at parse time). The boundary char before the word is
 * consumed, so the word itself is the named group `w`; use `wordIndex` / `stripAll` instead of `index` / `replace`.
 */
export function boundedRe(pattern: string): RegExp {
  return new RegExp(`(?:^|[^\\p{L}\\d])(?<w>${pattern})(?![\\p{L}\\d])`, 'iu')
}

/** Case-insensitive whole-word regex; Arabic letter variants (alef/ya/ta marbuta) are interchangeable. */
export function wordRe(source: string): RegExp {
  return boundedRe(`(?:${foldArabic(source)})`)
}

/** Start index of the matched word itself, past the boundary char the regex consumed. */
export function wordIndex(m: RegExpMatchArray): number {
  return (m.index ?? 0) + m[0].length - (m.groups?.w ?? m[0]).length
}

/** Blanks every match of `re`, keeping the boundary char that precedes the word. */
export function stripAll(text: string, re: RegExp): string {
  return text.replace(new RegExp(re.source, 'giu'), (m, ...rest) => {
    const w = (rest[rest.length - 1] as { w?: string } | undefined)?.w ?? m
    return `${m.slice(0, m.length - w.length)} `
  })
}

export function escapeRe(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
