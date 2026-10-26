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
