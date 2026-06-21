'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useAuth } from '@/components/auth/AuthProvider'
import { useT } from '@/lib/i18n'
import { clearBudgetData } from '@/lib/auth/clearBudgetData'
import { apiFetchAuth } from '@/lib/apiBase'

import { isSupabaseConfigured } from '@/lib/supabase/env'

export interface SettingsImportBannerState {
  variant: 'success' | 'error'
  text: string
}

/**
 * Local state, backup/import, and AI status polling for the settings screen.
 */
export function useSettingsPage() {
  const t = useT()

  const { user, signOut, openAuthModal } = useAuth()
  const store = useFinanceStore()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const supabaseConfigured = useMemo(
    () =>
      isSupabaseConfigured(),
    []
  )

  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [importBanner, setImportBanner] = useState<SettingsImportBannerState | null>(null)

  useEffect(() => {
    if (user?.email) {
      useFinanceStore.getState().updateProfile({ email: user.email })
    }
  }, [user?.email])

  useEffect(() => {
    if (!importBanner) return
    const t = setTimeout(() => setImportBanner(null), 6000)
    return () => clearTimeout(t)
  }, [importBanner])

  const handleExport = () => {
    const data = store.exportData()
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `buddget-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      if (!text) return
      try {
        store.importData(text)
        setImportBanner({ variant: 'success', text: t.settings.importSuccess })
      } catch (err) {
        setImportBanner({
          variant: 'error',
          text: err instanceof Error ? err.message : t.settings.importError,
        })
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const signOutAndHome = async () => {
    // signOut() owns all teardown and drops to the landing gate automatically.
    // Do NOT call clearBudgetData() first — it flips dataReady=false while mode
    // is still 'authenticated', triggering the 2.5s WelcomeScreen splash.
    await signOut()
  }

  const handleStartFresh = async () => {
    // Best-effort server wipe so data doesn't rehydrate from Supabase on next start.
    try {
      await apiFetchAuth('/api/account/reset-data', { method: 'POST' })
    } catch (e) {
      console.error('[startFresh] server wipe failed', e)
    }
    // Wipe localStorage + in-memory Zustand state.
    clearBudgetData()
    // Restore dataReady so the UI renders immediately instead of hanging on
    // the loading splash (resetAllData inside clearBudgetData sets it false,
    // and SupabaseFinanceSync's pull only fires on userId change — never here).
    useFinanceStore.getState().setDataReady(true)
  }

  return {
    user,
    openAuthModal,
    signOutAndHome,
    supabaseConfigured,
    fileInputRef,
    showResetConfirm,
    setShowResetConfirm,
    importBanner,
    handleExport,
    handleImport,
    handleStartFresh,
  }
}
