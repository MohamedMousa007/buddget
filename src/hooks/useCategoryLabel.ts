'use client'

import { useCallback } from 'react'
import { useT } from '@/lib/i18n'
import { categoryLabel } from '@/lib/i18n/categoryLabel'

/** `categoryLabel` bound to the app language. */
export function useCategoryLabel(): (category: string) => string {
  const t = useT()
  return useCallback((category: string) => categoryLabel(t, category), [t])
}
