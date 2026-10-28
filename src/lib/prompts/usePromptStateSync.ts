'use client'

import { useEffect } from 'react'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { settledKeys } from './settle'

/** Brings prompts answered on another phone into this phone's dismissed list, so every banner source honours them. */
export function usePromptStateSync(): void {
  const promptState = useFinanceStore((s) => s.settings.promptState)
  useEffect(() => {
    const keys = settledKeys(promptState)
    if (keys.length === 0) return
    useSettingsStore.setState((st) => {
      const missing = keys.filter((k) => !st.dismissedBanners.includes(k))
      return missing.length ? { dismissedBanners: [...st.dismissedBanners, ...missing] } : st
    })
  }, [promptState])
}
