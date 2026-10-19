import { settingsHubCopy } from '@/lib/i18n/settingsHubCopy'
import type { Locale } from '@/lib/i18n/types'
import { SETTINGS_REGISTRY, type SettingId } from '@/lib/settings/registry'

/** Lower-case, strip Arabic diacritics and unify letter variants so “اشتراك” matches “إشتراك”. */
export function normalizeQuery(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ً-ْـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[“”"«»]/g, '')
    .replace(/(^|\s)ال(?=\S{2,})/g, '$1')
    .trim()
}

interface Haystack {
  id: SettingId
  labelCurrent: string
  all: string
  exact: string[]
}

const HAYSTACK: Record<Locale, Haystack[]> = (['en', 'ar'] as const).reduce(
  (acc, locale) => {
    acc[locale] = SETTINGS_REGISTRY.map((s) => {
      const en = settingsHubCopy.en.items[s.id]
      const ar = settingsHubCopy.ar.items[s.id]
      return {
        id: s.id,
        labelCurrent: normalizeQuery(settingsHubCopy[locale].items[s.id].label),
        all: normalizeQuery(`${en.label} ${ar.label} ${en.keywords} ${ar.keywords}`),
        exact: [...(en.exact ?? []), ...(ar.exact ?? [])].map(normalizeQuery),
      }
    })
    return acc
  },
  {} as Record<Locale, Haystack[]>,
)

/**
 * Settings that match every word of the query, in the UI language or the other one.
 * Label starts-with ranks above label-contains, which ranks above a keyword hit.
 */
export function searchSettings(query: string, locale: Locale, signedIn = true): SettingId[] {
  const q = normalizeQuery(query)
  if (!q) return []
  const words = q.split(/\s+/)
  const needsAuth = new Set(SETTINGS_REGISTRY.filter((s) => s.needsAuth).map((s) => s.id))
  const scored: Array<{ id: SettingId; score: number }> = []
  for (const h of HAYSTACK[locale]) {
    if (!signedIn && needsAuth.has(h.id)) continue
    if (!words.every((w) => h.all.includes(w) || (w.length > 3 && w.endsWith('s') && h.all.includes(w.slice(0, -1))))) continue
    const score = h.exact.includes(q) ? 4 : h.labelCurrent.startsWith(q) ? 3 : h.labelCurrent.includes(q) ? 2 : words.every((w) => h.labelCurrent.includes(w)) ? 2 : 1
    scored.push({ id: h.id, score })
  }
  return scored.sort((a, b) => b.score - a.score).map((s) => s.id)
}
