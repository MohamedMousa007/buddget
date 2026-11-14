'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { localTodayISO } from '@/lib/utils/localDate'

import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useAuth } from '@/components/auth/AuthProvider'
import { useActionToast } from '@/components/ui/ActionToast'
import { useConfirm } from '@/components/ui/dialog/DialogProvider'
import { applyBackupImport } from '@/lib/backup/applyBackupImport'
import { useT } from '@/lib/i18n'
import { downloadOrShareFile } from '@/lib/utils/exportFile'
import { escapeCsvField } from '@/lib/utils/formatters'
import { isReportSpendRow } from '@/lib/constants/categoryMeta'
import type { Expense } from '@/lib/store/types'

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
  const store = useFinanceStore(
    useShallow((s) => ({ exportData: s.exportData, importData: s.importData, paymentMethods: s.paymentMethods, expenses: s.expenses })),
  )
  const toast = useActionToast()
  const confirm = useConfirm()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const supabaseConfigured = useMemo(
    () =>
      isSupabaseConfigured(),
    []
  )

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
    a.download = `buddget-backup-${localTodayISO()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleExportExpensesCsv = async () => {
    const methodName = (id: string) => store.paymentMethods.find((m) => m.id === id)?.name ?? id
    const { counted, yes, no } = t.reports.csv

    const result = await downloadOrShareFile(
      `buddget-expenses-${localTodayISO()}.csv`,
      expensesCsv(store.expenses, methodName, { counted, yes, no }),
      'text/csv',
    )
    if (result === 'saved') toast(t.expenses.fileSaved)
  }

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (event) => {
      const banner = await applyBackupImport(event.target?.result as string | null, {
        confirm: () => confirm({ title: t.settings.importConfirmTitle, body: t.settings.importConfirmBody, confirmLabel: t.settings.importConfirmLabel, destructive: true }),
        importData: store.importData,
        copy: { error: t.settings.importError, success: t.settings.importSuccess },
      })
      if (banner) setImportBanner(banner)
    }
    reader.onerror = () => setImportBanner({ variant: 'error', text: t.settings.importError })
    reader.readAsText(file)
    e.target.value = ''
  }

  const signOutAndHome = async () => {
    // signOut() owns all teardown and drops to the landing gate automatically.
    // Do NOT call clearBudgetData() first — it flips dataReady=false while mode
    // is still 'authenticated', triggering the 2.5s WelcomeScreen splash.
    await signOut()
  }

  return {
    user,
    openAuthModal,
    signOutAndHome,
    supabaseConfigured,
    fileInputRef,
    importBanner,
    handleExport,
    handleExportExpensesCsv,
    handleImport,
  }
}

export function expensesCsv(
  expenses: readonly Expense[],
  methodName: (id: string) => string,
  label: { counted: string; yes: string; no: string },
): string {
  const headers = `Date,Description,Category,Amount,Currency,Payment Method,${escapeCsvField(label.counted)}\n`
  const rows = expenses
    .map((e) =>
      [
        escapeCsvField(e.date),
        escapeCsvField(e.description),
        escapeCsvField(e.category),
        escapeCsvField(e.amount),
        escapeCsvField(e.currency),
        escapeCsvField(methodName(e.paymentMethodId)),
        escapeCsvField(isReportSpendRow(e) ? label.yes : label.no),
      ].join(','),
    )
    .join('\n')
  return headers + rows
}
