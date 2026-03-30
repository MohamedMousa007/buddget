/**
 * ISO 3166-1 alpha-2 country list for profile / settings UI.
 * Built from Intl (no extra dependency). Israel (IL) is excluded by product policy.
 */

const dnEn = new Intl.DisplayNames(['en'], { type: 'region' })

function collectAlpha2RegionCodes(): string[] {
  const out: string[] = []
  for (let i = 0; i < 26; i++) {
    for (let j = 0; j < 26; j++) {
      const code =
        String.fromCharCode(65 + i) + String.fromCharCode(65 + j)
      const name = dnEn.of(code)
      if (name && name !== code) out.push(code)
    }
  }
  return out
}

const EXCLUDED_CODES = new Set(['IL'])

const sortedCodes = collectAlpha2RegionCodes()
  .filter((c) => !EXCLUDED_CODES.has(c))
  .sort((a, b) => {
    const na = dnEn.of(a) ?? a
    const nb = dnEn.of(b) ?? b
    return na.localeCompare(nb, 'en')
  })

export type ProfileCountryOption = {
  code: string
  /** English display name stored in profile (backward compatible with free-text + APIs). */
  nameEn: string
}

export const PROFILE_COUNTRY_OPTIONS: readonly ProfileCountryOption[] = sortedCodes.map((code) => ({
  code,
  nameEn: dnEn.of(code) ?? code,
}))

const CODE_TO_OPTION = new Map(PROFILE_COUNTRY_OPTIONS.map((o) => [o.code, o]))
const NAME_EN_LOWER_TO_CODE = new Map(
  PROFILE_COUNTRY_OPTIONS.map((o) => [o.nameEn.toLowerCase(), o.code])
)

/**
 * Maps stored profile.country (English name or legacy alpha-2) to a select value code, or '' if empty / Israel / unknown.
 */
export function resolveProfileCountryToCode(stored: string | undefined): string {
  const s = stored?.trim() ?? ''
  if (!s) return ''

  const upper = s.toUpperCase()
  if (upper.length === 2 && CODE_TO_OPTION.has(upper)) {
    return upper
  }

  const byName = NAME_EN_LOWER_TO_CODE.get(s.toLowerCase())
  if (byName) return byName

  return ''
}

export function countryNameEnFromCode(code: string): string | undefined {
  return CODE_TO_OPTION.get(code.toUpperCase())?.nameEn
}

/**
 * Localized label for read-only UI. Unknown or excluded (e.g. Israel) values yield '' so callers can show an empty state.
 */
export function getProfileCountryDisplayLabel(
  stored: string | undefined,
  locale: string
): string {
  const code = resolveProfileCountryToCode(stored)
  if (!code) return ''
  const dn = new Intl.DisplayNames([locale], { type: 'region' })
  return dn.of(code) ?? countryNameEnFromCode(code) ?? ''
}
