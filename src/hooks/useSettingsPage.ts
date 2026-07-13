'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useAuth } from '@/components/auth/AuthProvider'
import { useActionToast } from '@/components/ui/ActionToast'
import { useT } from '@/lib/i18n'
import { apiFetchAuth } from '@/lib/apiBase'
import { downloadOrShareFile } from '@/lib/utils/exportFile'
import { escapeCsvField } from '@/lib/utils/formatters'

import { isSupabaseConfigured } from '@/lib/supabase/env'
import { navigate } from '@/lib/navigation/navigate'

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
  const toast = useActionToast()
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

  const handleExportExpensesCsv = async () => {
    const methodName = (id: string) => store.paymentMethods.find((m) => m.id === id)?.name ?? id
    const headers = 'Date,Description,Category,Amount,Currency,Payment Method\n'
    const rows = store.expenses
      .map((e) =>
        [
          escapeCsvField(e.date),
          escapeCsvField(e.description),
          escapeCsvField(e.category),
          escapeCsvField(e.amount),
          escapeCsvField(e.currency),
          escapeCsvField(methodName(e.paymentMethodId)),
        ].join(','),
      )
      .join('\n')

    const result = await downloadOrShareFile(
      `buddget-expenses-${new Date().toISOString().slice(0, 10)}.csv`,
      headers + rows,
      'text/csv',
    )
    if (result === 'saved') toast(t.expenses.fileSaved)
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
    // ponytail: fire reset concurrently — signOut() drops UI immediately, server wipe finishes in background
    const ac = new AbortController()
    const abortTimer = setTimeout(() => ac.abort(), 8000)
    void apiFetchAuth('/api/account/reset-data', { method: 'POST', signal: ac.signal })
      .catch(e => console.error('[startFresh] server wipe failed', e))
      .finally(() => clearTimeout(abortTimer))
    // Reset nav path so the user lands on dashboard (not /settings/data) after re-login.
    navigate('/')
    await signOutAndHome()
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
    handleExportExpensesCsv,
    handleImport,
    handleStartFresh,
  }
}
