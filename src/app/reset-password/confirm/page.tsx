'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Lock, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/env'
import { clearBudgetData } from '@/lib/auth/clearBudgetData'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import {
  inputClass,
  inputFocus,
  inputFocusError,
  inputFocusValid,
  inputStyle,
  MIN_PASSWORD_LEN,
} from '@/components/features/auth-modal/authModalTokens'
import { PasswordStrengthMeter } from '@/components/features/auth-modal/PasswordStrengthMeter'
import { PasswordVisibilityToggle } from '@/components/features/auth-modal/PasswordVisibilityToggle'
import { AuthPrimaryButton } from '@/components/features/auth-modal/AuthPrimaryButton'
import { AuthPasswordField } from '@/components/features/auth-modal/AuthPasswordField'
import { changePassword } from '@/lib/auth/changePassword'
import { useAuthSecurityCopy } from '@/lib/i18n/authSecurityCopy'

type ValidationTone = 'neutral' | 'valid' | 'error'

function toneClass(tone: ValidationTone): string {
  if (tone === 'error') return inputFocusError
  if (tone === 'valid') return inputFocusValid
  return inputFocus
}

export default function ResetPasswordConfirmPage() {
  const t = useT()
  const sec = useAuthSecurityCopy()
  const supabase = useMemo(
    () => (isSupabaseConfigured() ? createClient() : null),
    [],
  )
  // Opened from Settings with a live session: the current password is required. A recovery link has no such step.
  // Not rendered before the session check finishes, so reading the URL on first client render cannot mismatch the markup.
  const [fromSettings] = useState(() => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('from') === 'settings')
  const [current, setCurrent] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState('')
  // Terminal state when we've confirmed the link is unusable (timed out, or
  // updateUser rejected with a token-expired error). Shown as a friendly error
  // screen with a "Request a new link" CTA instead of a silent redirect.
  const [linkExpired, setLinkExpired] = useState(false)

  useEffect(() => {
    if (!supabase) return
    let cancelled = false
    void (async () => {
      const { data } = await supabase.auth.getSession()
      if (!cancelled && data.session) setChecking(false)
    })()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) setChecking(false)
    })
    const timeoutId = window.setTimeout(() => {
      void (async () => {
        if (cancelled) return
        const { data } = await supabase.auth.getSession()
        if (!data.session) {
          // Used to redirect silently to `/?error=reset`. Now surface the
          // expired-link state in-place so the user understands what happened
          // and can request a new link without hunting for the sign-in form.
          setChecking(false)
          setLinkExpired(true)
          return
        }
        setChecking(false)
      })()
    }, 8000)
    return () => {
      cancelled = true
      subscription.unsubscribe()
      window.clearTimeout(timeoutId)
    }
  }, [supabase])

  if (!supabase) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--color-brand-bg)]">
        <p className="text-sm text-[var(--color-brand-text-muted)]">{t.auth.errorFallback}</p>
      </div>
    )
  }

  // Mirror the auth modal's signup rules so the reset flow enforces the same bar.
  const passwordPasses =
    password.length >= MIN_PASSWORD_LEN && /[A-Za-z]/.test(password) && /\d/.test(password)
  const passwordTone: ValidationTone =
    password.length > 0 && passwordPasses ? 'valid' : 'neutral'
  const confirmTone: ValidationTone =
    confirm.length > 0 && password.length > 0
      ? confirm === password
        ? 'valid'
        : 'error'
      : 'neutral'

  const requestNewLink = () => {
    // Drop the user back on `/` with the sign-in modal auto-opened in the
    // forgot-password step. AuthProvider routes the message through.
    try {
      clearBudgetData()
    } catch {
      /* ignore */
    }
    // Leaves the bare reset-password context → full load into the app shell.
    window.location.replace('/?requestReset=1')
  }

  const submit = async () => {
    setError('')
    if (password.length < MIN_PASSWORD_LEN) {
      setError(t.resetPassword.errorMinLength(MIN_PASSWORD_LEN))
      return
    }
    if (!passwordPasses) {
      setError(t.resetPassword.errorWeakPassword)
      return
    }
    if (password !== confirm) {
      setError(t.resetPassword.errorMismatch)
      return
    }
    if (fromSettings && !current) {
      setError(sec.errorCurrentPasswordMissing)
      return
    }
    setLoading(true)
    const result = await changePassword({
      newPassword: password,
      ...(fromSettings ? { currentPassword: current } : {}),
      announce: !fromSettings,
    })
    if (result !== 'ok') {
      setLoading(false)
      if (result === 'same_password') setError(t.resetPassword.errorSamePassword)
      else if (result === 'wrong_password') setError(sec.errorWrongPassword)
      else if (result === 'reauth_required') setError(sec.errorReauthRequired)
      else if (result === 'rate_limited') setError(sec.errorTooManyAttempts)
      else if (result === 'unauthenticated') setLinkExpired(true)
      else setError(t.resetPassword.errorUpdateFailed)
      return
    }
    if (fromSettings) {
      // The session survives (other devices were signed out on the server): back to the security screen.
      window.location.replace('/settings/security')
      return
    }
    try {
      clearBudgetData()
    } catch (e) {
      console.error('[reset-password] clearBudgetData failed', e)
    }
    // Local scope clears this recovery session; the server has already signed out the account's other devices.
    await supabase.auth.signOut({ scope: 'local' })
    setLoading(false)
    // Leaves the bare reset-password context → full load into the app shell.
    window.location.replace('/')
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-brand-bg)]">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--color-brand-primary-ink)]" />
      </div>
    )
  }

  if (linkExpired) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--color-brand-bg)]">
        <div
          role="alert"
          className="w-full max-w-md border p-5 sm:p-6 rounded-2xl space-y-3 text-center"
          style={{ background: 'var(--color-brand-card)', borderColor: 'var(--color-brand-border)' }}
        >
          <div className="mx-auto w-12 h-12 rounded-full bg-[var(--color-brand-primary)]/10 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-[var(--color-brand-red)]" aria-hidden />
          </div>
          <h1 className="text-xl font-bold text-[var(--color-brand-text-primary)]">
            {t.resetPassword.errorLinkExpiredTitle}
          </h1>
          <p className="text-sm text-[var(--color-brand-text-muted)] leading-relaxed">
            {t.resetPassword.errorLinkExpired}
          </p>
          <AuthPrimaryButton onClick={requestNewLink}>
            {t.resetPassword.requestNewLink}
          </AuthPrimaryButton>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--color-brand-bg)]">
      <form
        className="w-full max-w-md border p-5 sm:p-6 rounded-2xl space-y-3"
        style={{ background: 'var(--color-brand-card)', borderColor: 'var(--color-brand-border)' }}
        onSubmit={(e) => { e.preventDefault(); void submit() }}
      >
        <h1 className="text-xl font-bold text-[var(--color-brand-text-primary)] text-center">
          {t.resetPassword.title}
        </h1>
        <p className="text-sm text-[var(--color-brand-text-muted)] text-center">
          {t.resetPassword.subtitle}
        </p>

        {fromSettings ? (
          <AuthPasswordField
            value={current}
            onChange={setCurrent}
            onSubmit={() => void submit()}
            label={sec.currentPasswordLabel}
            placeholder={sec.currentPasswordPlaceholder}
            autoComplete="current-password"
            name="current-password"
            disabled={loading}
          />
        ) : null}

        <div>
          <label className="text-xs text-[var(--color-brand-text-muted)] mb-1 block">
            {t.resetPassword.labelNew}
          </label>
          <div className="relative">
            <Lock className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-brand-text-muted)]" />
            <input
              type={showNew ? 'text' : 'password'}
              dir="ltr"
              name="new-password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t.resetPassword.placeholderNew}
              className={cn(inputClass, toneClass(passwordTone), 'ps-10 pe-10')}
              style={inputStyle}
            />
            <PasswordVisibilityToggle
              visible={showNew}
              onToggle={() => setShowNew((v) => !v)}
              label={showNew ? t.auth.hidePassword : t.auth.showPassword}
            />
          </div>
          <PasswordStrengthMeter password={password} />
        </div>

        <div>
          <label className="text-xs text-[var(--color-brand-text-muted)] mb-1 block">
            {t.resetPassword.labelConfirm}
          </label>
          <div className="relative">
            <Lock className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-brand-text-muted)]" />
            <input
              type={showConfirm ? 'text' : 'password'}
              dir="ltr"
              name="confirm-password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder={t.resetPassword.placeholderConfirm}
              className={cn(inputClass, toneClass(confirmTone), 'ps-10 pe-10')}
              style={inputStyle}
              aria-invalid={confirmTone === 'error'}
            />
            <PasswordVisibilityToggle
              visible={showConfirm}
              onToggle={() => setShowConfirm((v) => !v)}
              label={showConfirm ? t.auth.hidePassword : t.auth.showPassword}
            />
          </div>
        </div>

        {fromSettings ? <p className="text-xs text-[var(--color-brand-text-muted)]">{sec.otherDevicesNote}</p> : null}
        {error ? <p className="text-sm text-[var(--color-brand-red)]">{error}</p> : null}

        <AuthPrimaryButton type="submit" disabled={loading}>
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            t.resetPassword.buttonSubmit
          )}
        </AuthPrimaryButton>
      </form>
    </div>
  )
}
