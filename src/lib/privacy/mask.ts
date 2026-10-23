import type { PrivacySettings } from '@/lib/store/types'

export type PrivacySurface = 'hero' | 'lists' | 'notifications' | 'widgets' | 'buddgy'
export const MASK = '••••••'

/** Whether balances on `surface` are hidden. Everything is visible until the user opts in. */
export function isMasked(p: PrivacySettings | undefined, surface: PrivacySurface): boolean {
  switch (p?.preset ?? 'off') {
    case 'all': return true
    case 'hero': return surface === 'hero'
    case 'custom': return Boolean(p?.[surface])
    default: return false
  }
}
