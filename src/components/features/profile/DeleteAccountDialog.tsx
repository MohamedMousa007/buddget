'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Trash2, X, AlertTriangle } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { useScrollLock } from '@/lib/ui/scrollLock'

export interface DeleteAccountDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => Promise<void> | void
  inProgress: boolean
  error: string | null
}

/**
 * Two-stage confirmation for permanent account deletion.
 * - Warning card with full consequences copy
 * - User must type the exact confirm word (DELETE) to unlock the destructive button
 */
export function DeleteAccountDialog({ open, onClose, onConfirm, inProgress, error }: DeleteAccountDialogProps) {
  const t = useT()
  useScrollLock(open)
  const [typed, setTyped] = useState('')
  const expected = t.profile.deleteAccountConfirmWord
  const canConfirm = typed.trim().toUpperCase() === expected.toUpperCase() && !inProgress

  const handleClose = () => {
    if (inProgress) return
    setTyped('')
    onClose()
  }

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="presentation">
          <button
            type="button"
            aria-label={t.common.close}
            onClick={handleClose}
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
            aria-labelledby="delete-account-title"
          >
            <button
              type="button"
              onClick={handleClose}
              disabled={inProgress}
              className="absolute end-3 top-3 rounded-lg p-2 text-[var(--color-brand-text-muted)] transition-colors hover:bg-[var(--color-brand-text-primary)]/5 hover:text-[var(--color-brand-text-primary)] disabled:opacity-50"
              aria-label={t.common.close}
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-start gap-3 mb-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-red)]/15 text-[var(--color-brand-red)]">
                <AlertTriangle className="h-5 w-5" aria-hidden />
              </div>
              <div>
                <h2 id="delete-account-title" className="text-base font-semibold text-[var(--color-brand-text-primary)]">
                  {t.profile.deleteAccountConfirmTitle}
                </h2>
                <p className="mt-1 text-sm text-[var(--color-brand-text-secondary)] leading-relaxed">
                  {t.profile.deleteAccountConfirmBody}
                </p>
              </div>
            </div>

            <label className="block text-xs font-medium text-[var(--color-brand-text-muted)] mb-2">
              {t.profile.deleteAccountConfirmPrompt}
            </label>
            <input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              disabled={inProgress}
              autoComplete="off"
              spellCheck={false}
              placeholder={expected}
              className="w-full h-11 px-3 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-primary)] placeholder:text-[var(--color-brand-text-muted)] outline-none transition-colors focus:border-[var(--color-brand-red)] focus:ring-1 focus:ring-[var(--color-brand-red)] text-sm font-mono"
            />

            {error ? (
              <p className="mt-3 text-xs text-[var(--color-brand-red)]">{error}</p>
            ) : null}

            <div className="mt-5 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <button
                type="button"
                onClick={handleClose}
                disabled={inProgress}
                className="h-11 px-4 rounded-xl border border-[var(--color-brand-border)] text-sm font-medium text-[var(--color-brand-text-secondary)] hover:text-[var(--color-brand-text-primary)] hover:bg-[var(--color-brand-elevated)] transition-colors disabled:opacity-50"
              >
                {t.profile.deleteAccountCancel}
              </button>
              <button
                type="button"
                onClick={() => void onConfirm()}
                disabled={!canConfirm}
                className="h-11 px-4 rounded-xl bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="h-4 w-4" />
                {inProgress ? t.profile.deleteAccountInProgress : t.profile.deleteAccountConfirmButton}
              </button>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  )
}
