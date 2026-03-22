'use client'

import { Suspense, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { KeyRound, Lock, Mail } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PAGE_HEADER_SURFACE_CLASS } from '@/components/layout/PageHeader'

type AuthMode = 'signin' | 'signup'
type Phase = 'form' | 'verify-email'

const MIN_PASSWORD_LEN = 8

function LoginInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = useMemo(() => searchParams.get('next') || '/', [searchParams])

  const supabase = useMemo(() => createClient(), [])

  const [authMode, setAuthMode] = useState<AuthMode>('signin')
  const [phase, setPhase] = useState<Phase>('form')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/'

  const signIn = async () => {
    setError('')
    setMessage('')
    if (!email.trim() || !password) {
      setError('Enter your email and password')
      return
    }
    setLoading(true)
    const { error: e } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    setLoading(false)
    if (e) {
      setError(e.message)
      return
    }
    router.refresh()
    router.replace(safeNext)
  }

  const signUp = async () => {
    setError('')
    setMessage('')
    if (!email.trim() || !password) {
      setError('Enter email and password')
      return
    }
    if (password.length < MIN_PASSWORD_LEN) {
      setError(`Password must be at least ${MIN_PASSWORD_LEN} characters`)
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    setLoading(true)
    const { data, error: e } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      /** No emailRedirectTo — avoids embedding a magic-link URL from this app; confirm via OTP in the email. */
    })
    setLoading(false)
    if (e) {
      setError(e.message)
      return
    }
    if (data.session) {
      router.refresh()
      router.replace(safeNext)
      return
    }
    if (data.user) {
      setPhase('verify-email')
      setMessage(
        'Check your email for a 6-digit code to confirm your account. Magic links are not used — enter the code below.'
      )
      return
    }
    setError('Could not create account. Try again.')
  }

  const verifySignupOtp = async () => {
    setError('')
    setMessage('')
    const token = code.trim().replace(/\s/g, '')
    if (!token) {
      setError('Enter the 6-digit code from your email')
      return
    }
    setLoading(true)
    const { error: e } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token,
      type: 'signup',
    })
    setLoading(false)
    if (e) {
      setError(e.message)
      return
    }
    router.refresh()
    router.replace(safeNext)
  }

  const resendSignupCode = async () => {
    setError('')
    setMessage('')
    if (!email.trim()) return
    setLoading(true)
    const { error: e } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
    })
    setLoading(false)
    if (e) {
      setError(e.message)
      return
    }
    setMessage('A new code was sent. Use the numbers in the email (not a link).')
  }

  const forgotPassword = async () => {
    setError('')
    setMessage('')
    if (!email.trim()) {
      setError('Enter your email above first')
      return
    }
    setLoading(true)
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const { error: e } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      /** Supabase recovery still uses a link in the email by default; optional flow. */
      redirectTo: origin ? `${origin}/auth/callback?next=${encodeURIComponent(safeNext)}` : undefined,
    })
    setLoading(false)
    if (e) {
      setError(e.message)
      return
    }
    setMessage(
      'If an account exists, we sent a password reset email. Open the link on this device to finish (Supabase recovery uses a link).'
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className={PAGE_HEADER_SURFACE_CLASS}>
        <div className="px-4 py-3 lg:px-8">
          <h1 className="text-lg font-bold text-white font-heading">Buddget</h1>
          <p className="text-xs text-[var(--color-brand-text-muted)]">Email and password</p>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-2xl p-8 w-full max-w-md space-y-6"
        >
          {phase === 'verify-email' ? (
            <>
              <div className="flex flex-col items-center gap-2">
                <div className="w-14 h-14 rounded-2xl bg-[var(--color-brand-elevated)] flex items-center justify-center">
                  <KeyRound className="w-7 h-7 text-[var(--color-brand-red)]" />
                </div>
                <h2 className="text-xl font-bold text-white text-center">Confirm your email</h2>
                <p className="text-sm text-[var(--color-brand-text-muted)] text-center">
                  Code sent to <span className="text-white">{email}</span>
                </p>
              </div>

              <div className="space-y-3">
                <Label className="text-xs text-[var(--color-brand-text-secondary)]">6-digit code</Label>
                <Input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && void verifySignupOtp()}
                  className="bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white text-center text-2xl tracking-[0.4em] font-mono-numbers"
                />
                <button
                  type="button"
                  onClick={() => void resendSignupCode()}
                  disabled={loading}
                  className="text-xs text-[var(--color-brand-text-muted)] hover:text-white disabled:opacity-50"
                >
                  Resend code
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPhase('form')
                    setCode('')
                    setMessage('')
                    setError('')
                  }}
                  className="text-xs text-[var(--color-brand-text-muted)] hover:text-white"
                >
                  Back to sign in
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex rounded-xl border border-[var(--color-brand-border)] p-1 bg-[var(--color-brand-elevated)]/50">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('signin')
                    setError('')
                    setMessage('')
                  }}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    authMode === 'signin'
                      ? 'bg-[var(--color-brand-red)] text-white'
                      : 'text-[var(--color-brand-text-muted)] hover:text-white'
                  }`}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('signup')
                    setError('')
                    setMessage('')
                  }}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    authMode === 'signup'
                      ? 'bg-[var(--color-brand-red)] text-white'
                      : 'text-[var(--color-brand-text-muted)] hover:text-white'
                  }`}
                >
                  Create account
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs text-[var(--color-brand-text-secondary)]">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-brand-text-muted)]" />
                    <Input
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-[var(--color-brand-text-secondary)]">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-brand-text-muted)]" />
                    <Input
                      type="password"
                      autoComplete={authMode === 'signin' ? 'current-password' : 'new-password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void (authMode === 'signin' ? signIn() : signUp())
                      }}
                      className="pl-10 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white"
                    />
                  </div>
                  {authMode === 'signup' ? (
                    <p className="text-[10px] text-[var(--color-brand-text-muted)]">
                      At least {MIN_PASSWORD_LEN} characters
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void forgotPassword()}
                      disabled={loading}
                      className="text-[11px] text-[var(--color-brand-red)] hover:underline disabled:opacity-50"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>

                {authMode === 'signup' ? (
                  <div className="space-y-2">
                    <Label className="text-xs text-[var(--color-brand-text-secondary)]">Confirm password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-brand-text-muted)]" />
                      <Input
                        type="password"
                        autoComplete="new-password"
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && void signUp()}
                        className="pl-10 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white"
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          )}

          <AnimatePresence>
            {error ? (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="text-sm text-[var(--color-brand-red)] text-center"
              >
                {error}
              </motion.p>
            ) : null}
            {message ? (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="text-sm text-[var(--color-brand-green)] text-center"
              >
                {message}
              </motion.p>
            ) : null}
          </AnimatePresence>

          <div className="flex flex-col gap-3">
            {phase === 'verify-email' ? (
              <button
                type="button"
                onClick={() => void verifySignupOtp()}
                disabled={loading}
                className="w-full py-3 rounded-xl bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {loading ? 'Verifying…' : 'Confirm & continue'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void (authMode === 'signin' ? signIn() : signUp())}
                disabled={loading}
                className="w-full py-3 rounded-xl bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {loading ? 'Please wait…' : authMode === 'signin' ? 'Sign in' : 'Create account'}
              </button>
            )}
          </div>

          <p className="text-[11px] text-[var(--color-brand-text-muted)] text-center">
            Sign in uses your password. New accounts may need a one-time email code if confirmations are enabled — no
            magic-link login from Buddget.
          </p>
        </motion.div>
      </div>

      <footer className="p-4 text-center text-xs text-[var(--color-brand-text-muted)]">
        Buddget — your data stays in your account.
      </footer>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-sm text-[var(--color-brand-text-muted)]">
          Loading…
        </div>
      }
    >
      <LoginInner />
    </Suspense>
  )
}
