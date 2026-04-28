import type { Dictionary } from '@/lib/i18n/types'

/**
 * Resolve a dotted path against the loaded dictionary (e.g. `tour.foo.title`).
 * Returns empty string when missing — safe for tutorial overlay copy.
 */
export function readI18n(t: Dictionary, dottedPath: string): string {
  const parts = dottedPath.split('.').filter(Boolean)
  let cur: unknown = t
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in (cur as object)) {
      cur = (cur as Record<string, unknown>)[p]
    } else {
      return ''
    }
  }
  return typeof cur === 'string' ? cur : ''
}
