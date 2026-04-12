'use client'

import { useEffect } from 'react'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { applyTheme } from '@/lib/theme/applyTheme'

/**
 * Keeps the `dark` class on `<html>` in sync with the persisted theme setting.
 * Also listens for OS-level `prefers-color-scheme` changes when set to "system".
 */
export function useThemeSync() {
  const theme = useFinanceStore((s) => s.settings.theme)

  useEffect(() => {
    applyTheme(theme)

    if (theme !== 'system') return

    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => applyTheme('system')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])
}
