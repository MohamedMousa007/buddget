'use client'

import { useState } from 'react'
import { ModalShell } from '@/components/modals/ModalShell'
import { AuthPasswordField } from '@/components/features/auth-modal/AuthPasswordField'
import { Button } from '@/components/ui/button'
import { setTwoFactor, type TwoFactorResult } from '@/lib/auth/twoFactor'
import { useAuthSecurityCopy } from '@/lib/i18n/authSecurityCopy'
import { ModalTitle } from '@/components/modals/ModalTitle'

interface Props {
  open: boolean
  /** Accounts that sign in with Google or Apple only have no password to type; the server checks a fresh sign-in instead. */
  hasPassword: boolean
  onClose: () => void
  onTurnedOff: () => void
  /** Re-auth for another action. Default: switching 2-step off. */
  purpose?: 'twoFactorOff' | 'biometricEnrol'
  /** Runs the guarded action with the typed password; defaults to switching 2-step off. */
  onConfirm?: (password: string | undefined) => Promise<TwoFactorResult>
}

/** Re-authentication before a sensitive security change (2-step off by default). Reuses ModalShell, AuthPasswordField and Button. */
export function TwoFactorOffSheet({ open, hasPassword, onClose, onTurnedOff, purpose = 'twoFactorOff', onConfirm }: Props) {
  const c = useAuthSecurityCopy()
  const enrol = purpose === 'biometricEnrol'
  const copy = enrol
    ? { title: c.biometricEnrolTitle, body: c.biometricEnrolBody, confirm: c.biometricEnrolConfirm, cancel: c.gateNotNow, needsSignIn: c.biometricEnrolNeedsSignIn, failed: c.biometricEnrolFailed }
    : { title: c.twoFaOffTitle, body: c.twoFaOffBody, confirm: c.twoFaOffConfirm, cancel: c.twoFaOffCancel, needsSignIn: c.twoFaOffNeedsSignIn, failed: c.twoFaChangeFailed }
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const close = () => {
    if (busy) return
    setPassword('')
    setError('')
    onClose()
  }

  const confirm = async () => {
    if (hasPassword && !password) {
      setError(c.errorCurrentPasswordMissing)
      return
    }
    setBusy(true)
    setError('')
    const typed = hasPassword ? password : undefined
    const result = await (onConfirm ? onConfirm(typed) : setTwoFactor(false, typed))
    setBusy(false)
    if (result === 'ok') {
      setPassword('')
      onTurnedOff()
      return
    }
    setError(
      result === 'wrong_password' ? c.errorWrongPassword
        : result === 'rate_limited' ? c.errorTooManyAttempts
          : result === 'reauth_required' ? copy.needsSignIn
            : copy.failed,
    )
  }

  return (
    <ModalShell open={open} onBackdropClick={close} padContent>
      <form className="flex flex-col gap-3 pt-1" onSubmit={(e) => { e.preventDefault(); void confirm() }}>
        <ModalTitle className="text-[21px] font-bold leading-tight tracking-[-0.02em] text-[var(--color-brand-text-primary)]">{copy.title}</ModalTitle>
        <p className="text-[14.5px] leading-snug text-[var(--color-brand-text-secondary)]">{copy.body}</p>
        {hasPassword ? (
          <AuthPasswordField
            value={password}
            onChange={setPassword}
            onSubmit={() => void confirm()}
            label={c.currentPasswordLabel}
            placeholder={c.currentPasswordPlaceholder}
            autoComplete="current-password"
            name="current-password"
            disabled={busy}
            tone={error ? 'error' : 'neutral'}
          />
        ) : null}
        {error ? <p role="alert" className="text-sm text-[var(--color-brand-red)]">{error}</p> : null}
        <Button type="submit" size="cta" variant={enrol ? 'default' : 'destructive'} className="w-full" loading={busy}>{copy.confirm}</Button>
        <Button type="button" variant="ghost" size="touch" className="w-full" onClick={close} disabled={busy}>{copy.cancel}</Button>
      </form>
    </ModalShell>
  )
}
