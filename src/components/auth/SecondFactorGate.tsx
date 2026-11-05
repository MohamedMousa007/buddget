'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { apiFetchAuth } from '@/lib/apiBase'
import { mapAuthError } from '@/components/auth/authErrors'
import { useAuth } from '@/components/auth/auth-context'
import { useT } from '@/lib/i18n'
import { useAuthSecurityCopy } from '@/lib/i18n/authSecurityCopy'
import { useSecondFactorGate } from '@/lib/auth/secondFactorGate'
import { AuthVerifyStep } from '@/components/features/auth-modal/AuthVerifyStep'
import { cardStyle } from '@/components/features/auth-modal/authModalTokens'
import { Scrim } from '@/components/ui/Scrim'
import { useDialogFocus } from '@/hooks/useDialogFocus'
import { Button } from '@/components/ui/button'

/**
 * Shown when the server refuses a signed-in session with second_factor_required. Reuses the email-OTP verify step:
 * the code upgrades this same session in place (no sign-out, local data untouched), the server is told, and the
 * interrupted sync resumes through the gate's resolve listeners. Dismissing silences the gate for a while.
 */
export function SecondFactorGate() {
  const open = useSecondFactorGate((s) => s.open)
  return open ? <Challenge /> : null
}

function Challenge() {
  const t = useT()
  const sec = useAuthSecurityCopy()
  const { user, signOut } = useAuth()
  const email = user?.email ?? ''
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [cooldown, setCooldown] = useState(0)
  const sent = useRef(false)
  const panelRef = useRef<HTMLDivElement>(null)
  useDialogFocus(true, panelRef, true)

  const send = useCallback(async () => {
    if (!email) return
    const { error: e } = await createClient().auth.signInWithOtp({ email, options: { shouldCreateUser: false } })
    if (e) setError(mapAuthError(e, 'resend', t))
    else setCooldown(60)
  }, [email, t])

  useEffect(() => {
    if (sent.current) return
    sent.current = true
    void send()
  }, [send])

  useEffect(() => {
    if (cooldown <= 0) return
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(id)
  }, [cooldown])

  const verify = async () => {
    const token = otp.replace(/\D/g, '').slice(0, 6)
    if (token.length !== 6) {
      setError(t.auth.errorOtpIncomplete)
      return
    }
    setLoading(true)
    setError('')
    const { error: e } = await createClient().auth.verifyOtp({ email, token, type: 'email' })
    if (e) {
      setLoading(false)
      setError(sec.gateFailed)
      return
    }
    try {
      const res = await apiFetchAuth('/api/auth/second-factor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: 'otp' }),
      })
      if (!res.ok) throw new Error('not recorded')
    } catch {
      setLoading(false)
      setError(sec.gateFailed)
      return
    }
    setLoading(false)
    useSecondFactorGate.getState().resolve()
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4" role="presentation">
      <Scrim label={sec.gateNotNow} onClick={() => useSecondFactorGate.getState().dismiss()} tone="light" />
      <div
        ref={panelRef}
        tabIndex={-1}
        className="relative z-10 w-full border p-5 sm:p-6 shadow-2xl space-y-4 outline-none"
        style={cardStyle}
        role="dialog"
        aria-modal="true"
      >
        <p className="text-sm text-center text-[var(--color-brand-text-muted)]">{sec.gateIntro}</p>
        <AuthVerifyStep
          email={email}
          otp={otp}
          onOtpChange={setOtp}
          loading={loading}
          resendCooldown={cooldown}
          purpose="2fa"
          onVerify={verify}
          onResend={send}
          onUseDifferentEmail={() => void signOut()}
        />
        {error ? <p role="alert" className="text-sm text-center text-[var(--color-status-danger-fg)]">{error}</p> : null}
        <div className="flex justify-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => useSecondFactorGate.getState().dismiss()}>{sec.gateNotNow}</Button>
          <Button variant="ghost" size="sm" onClick={() => void signOut()}>{sec.gateSignOut}</Button>
        </div>
      </div>
    </div>
  )
}
