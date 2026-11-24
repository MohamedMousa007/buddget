'use client'

import { useEffect } from 'react'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { applyTheme } from '@/lib/theme/applyTheme'

/** Keeps the `dark` class on `<html>` in sync with the persisted theme setting. */
export function useThemeSync() {
  const theme = useFinanceStore((s) => s.settings.theme)

  useEffect(() => {
    applyTheme(theme)
  }, [theme])
}
