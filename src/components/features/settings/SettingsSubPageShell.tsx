'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { navigate } from '@/lib/navigation/navigate'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { PageHeader, PageHeaderContent } from '@/components/layout/PageHeader'
import { SettingsSaveButton } from '@/components/features/settings/SettingsSaveButton'
import { flushFinanceNow } from '@/components/sync/SupabaseFinanceSync'
import { useActionToast } from '@/components/ui/ActionToast'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { registerBackGuard } from '@/lib/navigation/backGuard'
import { useLocale, useT } from '@/lib/i18n'

interface Props {
  title: string
  children: React.ReactNode
  /** Show the "Save" header action (force-push to server). Default true. */
  showSave?: boolean
}

export function SettingsSubPageShell({ title, children, showSave = true }: Props) {
  const { locale } = useLocale()
  const t = useT()
  const isRtl = locale === 'ar'
  const showToast = useActionToast()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const confirmOpenRef = useRef(confirmOpen)
  useEffect(() => { confirmOpenRef.current = confirmOpen }, [confirmOpen])

  // Sections write to the store on change (live feedback); dirty = drifted
  // from the mount snapshot, discard = restore that snapshot. The selector
  // makes dirtiness reactive so the Save button can show/hide itself.
  const snapshotRef = useRef(useFinanceStore.getState().settings)
  const [, bumpBaseline] = useState(0) // re-render when the saved baseline moves
  const settings = useFinanceStore((s) => s.settings)
  const dirty = JSON.stringify(settings) !== JSON.stringify(snapshotRef.current)
  const isDirty = () =>
    JSON.stringify(useFinanceStore.getState().settings) !== JSON.stringify(snapshotRef.current)

  useEffect(() => registerBackGuard(() => {
    if (confirmOpenRef.current) {
      setConfirmOpen(false)
      return true
    }
    if (!isDirty()) return false
    setConfirmOpen(true)
    return true
  }), [])

  const goBack = () => navigate('/settings')

  const onBackClick = () => {
    if (isDirty()) setConfirmOpen(true)
    else goBack()
  }

  const onSaveAndLeave = async () => {
    setConfirmOpen(false)
    try {
      await flushFinanceNow()
      showToast(t.common.savedSynced)
    } catch {
      // best-effort; next auto-flush retries
    }
    goBack()
  }

  const onDiscardAndLeave = () => {
    useFinanceStore.getState().updateSettings(snapshotRef.current)
    setConfirmOpen(false)
    goBack()
  }

  return (
    <div className="min-h-screen">
      <PageHeader>
        <PageHeaderContent>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onBackClick}
              className="flex h-11 w-11 items-center justify-center rounded-xl text-[var(--color-brand-text-muted)] hover:bg-[var(--color-brand-elevated)] transition-colors shrink-0"
              aria-label="Back to Settings"
            >
              {isRtl
                ? <ChevronRight className="h-5 w-5" />
                : <ChevronLeft className="h-5 w-5" />}
            </button>
            <h1 className="text-xl font-bold text-[var(--color-brand-text-primary)]">{title}</h1>
            {showSave ? <div className="ms-auto"><SettingsSaveButton dirty={dirty} onSaved={() => { snapshotRef.current = useFinanceStore.getState().settings; bumpBaseline((n) => n + 1) }} /></div> : null}
          </div>
        </PageHeaderContent>
      </PageHeader>
      <div className="px-4 py-4 lg:px-6 max-w-3xl mx-auto space-y-4">
        {children}
      </div>

      <AnimatePresence>
        {confirmOpen ? (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="presentation">
            <button
              type="button"
              aria-label={t.common.close}
              onClick={() => setConfirmOpen(false)}
              className="absolute inset-0 cursor-default bg-black/40 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="relative z-10 w-full max-w-md rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-6 shadow-2xl"
              role="dialog"
              aria-modal="true"
              aria-labelledby="settings-unsaved-title"
            >
              <h2 id="settings-unsaved-title" className="text-base font-semibold text-[var(--color-brand-text-primary)]">
                {t.settings.unsavedTitle}
              </h2>
              <p className="mt-1 text-sm text-[var(--color-brand-text-secondary)] leading-relaxed">
                {t.settings.unsavedBody}
              </p>
              <div className="mt-5 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmOpen(false)}
                  className="h-11 px-4 rounded-xl border border-[var(--color-brand-border)] text-sm font-medium text-[var(--color-brand-text-secondary)] hover:text-[var(--color-brand-text-primary)] hover:bg-[var(--color-brand-elevated)] transition-colors"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="button"
                  onClick={onDiscardAndLeave}
                  className="h-11 px-4 rounded-xl border border-[var(--color-brand-border)] text-sm font-medium text-[var(--color-brand-red)] hover:bg-[var(--color-brand-red)]/10 transition-colors"
                >
                  {t.profile.discard}
                </button>
                <button
                  type="button"
                  onClick={() => void onSaveAndLeave()}
                  className="h-11 px-4 rounded-xl bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white text-sm font-semibold transition-colors"
                >
                  {t.common.save}
                </button>
              </div>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
