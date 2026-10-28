/**
 * Maps Arabic-Indic (٠-٩) and Persian (۰-۹) digits to ASCII and the Arabic decimal/thousands
 * separators (٫ ٬) to "." and ",". Every replacement is one UTF-16 unit for one, so capture
 * spans computed on the result still index the original text.
 */
export function normalizeDigits(text: string): string {
  return text.replace(/[٠-٩۰-۹٫٬]/g, (ch) => {
    if (ch === '٫') return '.'
    if (ch === '٬') return ','
    const code = ch.charCodeAt(0)
    return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660)
  })
}

/**
 * Invisible bidi and format marks that Arabic/mixed-direction SMS carry between words and digits:
 * LRM/RLM, the embedding/override/isolate controls, ALM, BOM, ZWJ and ZWNJ. They are never part of a
 * field value, and a learned regex that embeds one never matches the next message.
 */
const FORMAT_MARKS = /[‌-‏‪-‮⁦-⁩؜﻿]/g

export function stripFormatMarks(text: string): string {
  return text.replace(FORMAT_MARKS, '')
}

/**
 * The one text form used for MATCHING and LEARNING: format marks removed, Arabic/Persian digits and
 * separators mapped to ASCII. Arabic letters are never touched. It changes length (marks are removed),
 * so capture spans index THIS text, not the original. Never hash this: the dedup hash is over the raw
 * message so a retry from an older build cannot create a second row.
 */
export function normalizeSmsText(raw: string): string {
  return normalizeDigits(stripFormatMarks(raw))
}
