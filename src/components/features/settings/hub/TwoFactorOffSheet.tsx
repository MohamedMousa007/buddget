'use client'

import { useState } from 'react'
import { ModalShell } from '@/components/modals/ModalShell'
import { AuthPasswordField } from '@/components/features/auth-modal/AuthPasswordField'
import { Button } from '@/components/ui/button'
import { setTwoFactor } from '@/lib/auth/twoFactor'
import { useAuthSecurityCopy } from '@/lib/i18n/authSecurityCopy'

interface Props {
  open: boolean
  /** Accounts that sign in with Google or Apple only have no password to type; the server checks a fresh sign-in instead. */
  hasPassword: boolean
  onClose: () => void
  onTurnedOff: () => void
}

/** Re-authentication before 2-step verification is switched off. Reuses ModalShell, AuthPasswordField and Button. */
export function TwoFactorOffSheet({ open, hasPassword, onClose, onTurnedOff }: Props) {
  const c = useAuthSecurityCopy()
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
    const result = await setTwoFactor(false, hasPassword ? password : undefined)
    setBusy(false)
    if (result === 'ok') {
      setPassword('')
      onTurnedOff()
      return
    }
    setError(
      result === 'wrong_password' ? c.errorWrongPassword
        : result === 'rate_limited' ? c.errorTooManyAttempts
          : result === 'reauth_required' ? c.twoFaOffNeedsSignIn
            : c.twoFaChangeFailed,
    )
  }

  return (
    <ModalShell open={open} onBackdropClick={close} padContent>
      <form className="flex flex-col gap-3 pt-1" onSubmit={(e) => { e.preventDefault(); void confirm() }}>
        <h2 className="text-[21px] font-bold leading-tight tracking-[-0.02em] text-[var(--color-brand-text-primary)]">{c.twoFaOffTitle}</h2>
        <p className="text-[14.5px] leading-snug text-[var(--color-brand-text-secondary)]">{c.twoFaOffBody}</p>
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
        <Button type="submit" size="cta" variant="destructive" className="w-full" loading={busy}>{c.twoFaOffConfirm}</Button>
        <Button type="button" variant="ghost" size="touch" className="w-full" onClick={close} disabled={busy}>{c.twoFaOffCancel}</Button>
      </form>
    </ModalShell>
  )
}
