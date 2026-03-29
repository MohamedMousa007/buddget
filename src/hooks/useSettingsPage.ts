'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useAuth } from '@/components/auth/AuthProvider'
import { checkAIStatus } from '@/lib/ai/gemini'
import { clearBudgetData } from '@/lib/auth/clearBudgetData'

export interface SettingsImportBannerState {
  variant: 'success' | 'error'
  text: string
}

/**
 * Local state, backup/import, and AI status polling for the settings screen.
 */
export function useSettingsPage() {
  const router = useRouter()
  const { user, signOut, openAuthModal } = useAuth()
  const store = useFinanceStore()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const supabaseConfigured = useMemo(
    () =>
      !!(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()),
    []
  )

  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [aiStatus, setAiStatus] = useState<{ enabled: boolean; model: string }>({ enabled: false, model: '' })
  const [importBanner, setImportBanner] = useState<SettingsImportBannerState | null>(null)

  useEffect(() => {
    checkAIStatus().then(setAiStatus)
  }, [])

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
        setImportBanner({ variant: 'success', text: 'Your data is all set — import complete!' })
      } catch (err) {
        setImportBanner({
          variant: 'error',
          text: err instanceof Error ? err.message : 'Something went wrong with the import. Give it another try.',
        })
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const signOutAndHome = async () => {
    clearBudgetData()
    await signOut()
    router.replace('/')
  }

  return {
    router,
    store,
    user,
    openAuthModal,
    signOutAndHome,
    supabaseConfigured,
    fileInputRef,
    showResetConfirm,
    setShowResetConfirm,
    aiStatus,
    importBanner,
    handleExport,
    handleImport,
  }
}
