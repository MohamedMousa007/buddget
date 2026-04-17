'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Lock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
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

type ValidationTone = 'neutral' | 'valid' | 'error'

function toneClass(tone: ValidationTone): string {
  if (tone === 'error') return inputFocusError
  if (tone === 'valid') return inputFocusValid
  return inputFocus
}

export default function ResetPasswordConfirmPage() {
  const router = useRouter()
  const t = useT()
  const supabase = useMemo(() => createClient(), [])
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
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
    const t = window.setTimeout(() => {
      void (async () => {
        if (cancelled) return
        const { data } = await supabase.auth.getSession()
        if (!data.session) {
          router.replace('/?error=reset')
          return
        }
        setChecking(false)
      })()
    }, 8000)
    return () => {
      cancelled = true
      subscription.unsubscribe()
      window.clearTimeout(t)
    }
  }, [supabase, router])

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
    setLoading(true)
    const { error: e } = await supabase.auth.updateUser({ password })
    if (e) {
      setLoading(false)
      setError(t.resetPassword.errorUpdateFailed)
      return
    }
    try {
      clearBudgetData()
    } catch (e) {
      console.error('[reset-password] clearBudgetData failed', e)
    }
    const { error: signOutError } = await supabase.auth.signOut()
    setLoading(false)
    if (signOutError) {
      setError(t.resetPassword.errorUpdateFailed)
      return
    }
    // AuthProvider listens for ?passwordUpdated=1 and opens the sign-in modal.
    router.replace('/?passwordUpdated=1')
    router.refresh()
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-brand-bg)]">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--color-brand-red)]" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--color-brand-bg)]">
      <div
        className="w-full max-w-md border p-8 rounded-2xl space-y-4"
        style={{ background: 'var(--color-brand-card)', borderColor: 'var(--color-brand-border)' }}
      >
        <h1 className="text-xl font-bold text-[var(--color-brand-text-primary)] text-center">
          {t.resetPassword.title}
        </h1>
        <p className="text-sm text-[var(--color-brand-text-muted)] text-center">
          {t.resetPassword.subtitle}
        </p>

        <div>
          <label className="text-xs text-[var(--color-brand-text-muted)] mb-1 block">
            {t.resetPassword.labelNew}
          </label>
          <div className="relative">
            <Lock className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-brand-text-muted)]" />
            <input
              type={showNew ? 'text' : 'password'}
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
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void submit()}
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

        {error ? <p className="text-sm text-[var(--color-brand-red)]">{error}</p> : null}

        <AuthPrimaryButton disabled={loading} onClick={() => void submit()}>
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            t.resetPassword.buttonSubmit
          )}
        </AuthPrimaryButton>
      </div>
    </div>
  )
}
