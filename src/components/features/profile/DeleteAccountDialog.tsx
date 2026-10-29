'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Trash2, X, AlertTriangle } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { useScrollLock } from '@/lib/ui/scrollLock'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Scrim } from '@/components/ui/Scrim'
import { useDismissable } from '@/hooks/useDismissable'
import { IconButton } from '@/components/ui/IconButton'

export interface DeleteAccountDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: (password?: string) => Promise<void> | void
  inProgress: boolean
  error: string | null
  /** The server asked for a fresh sign-in: collect the password and re-authenticate before deleting. */
  reauthNeeded?: boolean
}

/**
 * Two-stage confirmation for permanent account deletion.
 * - Warning card with full consequences copy
 * - User must type the exact confirm word (DELETE) to unlock the destructive button
 */
export function DeleteAccountDialog({ open, onClose, onConfirm, inProgress, error, reauthNeeded = false }: DeleteAccountDialogProps) {
  useDismissable(open, onClose)
  const t = useT()
  useScrollLock(open)
  const [typed, setTyped] = useState('')
  const [password, setPassword] = useState('')
  const expected = t.profile.deleteAccountConfirmWord
  const canConfirm = typed.trim().toUpperCase() === expected.toUpperCase() && !inProgress && (!reauthNeeded || password.length > 0)

  const handleClose = () => {
    if (inProgress) return
    setTyped('')
    setPassword('')
    onClose()
  }

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="presentation">
          <Scrim label={t.common.close} onClick={handleClose} />
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
            <IconButton
              onClick={handleClose}
              disabled={inProgress}
              aria-label={t.common.close}
              size="sm"
              className="absolute end-3 top-3"
            >
              <X className="h-5 w-5" />
            </IconButton>

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
            <Input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              disabled={inProgress}
              autoComplete="off"
              spellCheck={false}
              placeholder={expected}
              size="brand" className="text-[var(--color-brand-text-primary)] focus:border-[var(--color-brand-red)] focus-visible:ring-[var(--color-brand-red)]/40 text-sm font-mono"
            />

            {reauthNeeded ? (
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={inProgress}
                autoComplete="current-password"
                aria-label={t.profile.deleteAccountReauthPrompt}
                size="brand" className="mt-3 text-[var(--color-brand-text-primary)] text-sm"
              />
            ) : null}

            {error ? (
              <p role="alert" className="mt-3 text-xs text-[var(--color-brand-red)]">{error}</p>
            ) : null}

            <div className="mt-5 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <Button
                variant="outline"
                size="touch"
                onClick={handleClose}
                disabled={inProgress}
                className="text-sm font-medium"
              >
                {t.profile.deleteAccountCancel}
              </Button>
              <Button
                variant="destructive-solid"
                size="touch"
                onClick={() => void onConfirm(reauthNeeded ? password : undefined)}
                disabled={!canConfirm}
                className="text-sm font-semibold disabled:cursor-not-allowed"
              >
                <Trash2 className="h-4 w-4" />
                {inProgress ? t.profile.deleteAccountInProgress : t.profile.deleteAccountConfirmButton}
              </Button>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  )
}
