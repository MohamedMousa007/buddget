'use client'

import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { isMasked, type PrivacySurface } from './mask'

export function useMask(surface: PrivacySurface): boolean {
  return useFinanceStore((s) => isMasked(s.settings.privacy, surface))
}

/** One-tap eye: hides every surface, or shows them all again. */
export function useToggleHideAll(): { hidden: boolean; toggle: () => void } {
  const privacy = useFinanceStore((s) => s.settings.privacy)
  const updateSettings = useFinanceStore((s) => s.updateSettings)
  const hidden = privacy?.preset === 'all'
  return { hidden, toggle: () => updateSettings({ privacy: { ...privacy, preset: hidden ? 'off' : 'all' } }) }
}
