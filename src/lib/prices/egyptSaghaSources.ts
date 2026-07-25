import type { GoldKarat } from '@/lib/store/types'
import { impliedSaghaFromKarat } from '@/lib/prices/egyptGold'

/**
 * Keyless Egyptian gold sources, each yielding an implied دولار الصاغة (Sagha dollar).
 *
 * Extraction is content-anchored regex — no CSS selectors (survive a restyle) and no LLM in the
 * scheduled path (the number is validated arithmetically downstream). A source that renders prices
 * client-side (returns 00.00 or nothing in raw HTML) is simply dropped: its extractor returns null.
 *
 * Two shapes: a source either publishes the Sagha dollar directly, or a karat price we back-calc
 * to the scalar using the current spot ounce. Both normalise to one comparable number for consensus.
 */

const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩'

/** Normalise Arabic-Indic digits, strip thousands separators, parse. */
export function parseArabicNumber(raw: string): number | null {
  let s = ''
  for (const ch of raw) {
    const ai = ARABIC_INDIC.indexOf(ch)
    s += ai >= 0 ? String(ai) : ch
  }
  s = s.replace(/,/g, '').trim()
  const m = s.match(/-?\d+(\.\d+)?/)
  if (!m) return null
  const n = Number(m[0])
  return Number.isFinite(n) ? n : null
}

/** Collapse tags + whitespace so a text anchor can be found regardless of markup. */
export function htmlToText(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
}

/** First number appearing after `anchor` in the text, within `window` chars. */
export function numberAfter(text: string, anchor: string | RegExp, window = 40): number | null {
  const re = typeof anchor === 'string' ? new RegExp(anchor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) : anchor
  const m = re.exec(text)
  if (!m) return null
  const after = text.slice(m.index + m[0].length, m.index + m[0].length + window)
  const num = after.match(new RegExp(`[${ARABIC_INDIC}\\d][${ARABIC_INDIC}\\d.,]*`))
  return num ? parseArabicNumber(num[0]) : null
}

export interface EgyptSaghaSource {
  id: string
  url: string
  /** Distinct upstream feed for consensus de-duplication. */
  upstream: string
  /** Return the implied Sagha dollar from raw HTML, or null if unparseable/JS-rendered. */
  extract: (html: string, ctx: { ounceUsd: number }) => number | null
}

/** Extract a karat price and back-calc to the Sagha dollar. */
function karatSource(id: string, url: string, upstream: string, anchor: string, karat: GoldKarat): EgyptSaghaSource {
  return {
    id,
    url,
    upstream,
    extract: (html, ctx) => {
      const price = numberAfter(htmlToText(html), anchor)
      if (price === null || price <= 0) return null
      const sagha = impliedSaghaFromKarat(price, karat, ctx.ounceUsd)
      return sagha > 0 ? sagha : null
    },
  }
}

export const EGYPT_SAGHA_SOURCES: EgyptSaghaSource[] = [
  {
    id: 'realegp',
    url: 'https://realegp.com/gold/usdsagha',
    upstream: 'realegp',
    // "... متوسط السعر 52.41 ..." — the Sagha dollar, published directly.
    extract: (html) => numberAfter(htmlToText(html), 'متوسط السعر'),
  },
  {
    id: 'souq-price-today',
    url: 'https://souq-price-today.com/',
    upstream: 'souq-price-today',
    // "دولار الصاغة 52.46 ..." — published directly.
    extract: (html) => numberAfter(htmlToText(html), 'دولار الصاغة'),
  },
  // "عيار 21 5,960" — a 21k gram price, back-calculated to the scalar.
  karatSource('dollaregypt', 'https://www.dollaregypt.com/', 'dollaregypt', 'عيار 21', 21),
]
