'use client'

import { Suspense, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Mail, ArrowRight, KeyRound } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { PAGE_HEADER_SURFACE_CLASS } from '@/components/layout/PageHeader'

function LoginInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = useMemo(() => searchParams.get('next') || '/', [searchParams])

  const supabase = useMemo(() => createClient(), [])

  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [phase, setPhase] = useState<'email' | 'otp'>('email')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const sendOtp = async () => {
    setError('')
    setMessage('')
    if (!email.trim()) {
      setError('Enter your email')
      return
    }
    setLoading(true)
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/'
    const { error: e } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: true,
        /** Magic link in the email must point here so the link works on production (also set Site URL + Redirect URLs in Supabase). */
        emailRedirectTo: origin ? `${origin}/auth/callback?next=${encodeURIComponent(safeNext)}` : undefined,
      },
    })
    setLoading(false)
    if (e) {
      setError(e.message)
      return
    }
    setPhase('otp')
    setMessage(
      'Check your email: use the 6-digit code below, or tap “Confirm” / the link in the email (it must open in this browser).'
    )
  }

  const verifyOtp = async () => {
    setError('')
    setMessage('')
    if (!code.trim()) {
      setError('Enter the code from your email')
      return
    }
    setLoading(true)
    const { error: e } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim().replace(/\s/g, ''),
      type: 'email',
    })
    setLoading(false)
    if (e) {
      setError(e.message)
      return
    }
    router.refresh()
    router.replace(next.startsWith('/') ? next : '/')
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className={PAGE_HEADER_SURFACE_CLASS}>
        <div className="px-4 py-3 lg:px-8">
          <h1 className="text-lg font-bold text-white font-heading">Buddget</h1>
          <p className="text-xs text-[var(--color-brand-text-muted)]">Sign in with email</p>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-2xl p-8 w-full max-w-md space-y-6"
        >
          {phase === 'email' ? (
            <>
              <div className="flex flex-col items-center gap-2">
                <div className="w-14 h-14 rounded-2xl bg-[var(--color-brand-elevated)] flex items-center justify-center">
                  <Mail className="w-7 h-7 text-[var(--color-brand-red)]" />
                </div>
                <h2 className="text-xl font-bold text-white text-center">Continue with email</h2>
                <p className="text-sm text-[var(--color-brand-text-muted)] text-center">
                  We&apos;ll send a one-time code. No password to remember.
                </p>
              </div>

              <div className="space-y-3">
                <Input
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && void sendOtp()}
                  className="bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white"
                />
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col items-center gap-2">
                <div className="w-14 h-14 rounded-2xl bg-[var(--color-brand-elevated)] flex items-center justify-center">
                  <KeyRound className="w-7 h-7 text-[var(--color-brand-red)]" />
                </div>
                <h2 className="text-xl font-bold text-white text-center">Enter code</h2>
                <p className="text-sm text-[var(--color-brand-text-muted)] text-center">
                  Sent to <span className="text-white">{email}</span>
                </p>
              </div>

              <div className="space-y-3">
                <Input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="6-digit code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && void verifyOtp()}
                  className="bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white text-center text-2xl tracking-[0.4em] font-mono-numbers"
                />
                <button
                  type="button"
                  onClick={() => {
                    setPhase('email')
                    setCode('')
                    setMessage('')
                    setError('')
                  }}
                  className="text-xs text-[var(--color-brand-text-muted)] hover:text-white"
                >
                  Use a different email
                </button>
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
                className="text-sm text-[var(--color-brand-green)] text-center"
              >
                {message}
              </motion.p>
            ) : null}
          </AnimatePresence>

          <div className="flex flex-col gap-3">
            {phase === 'email' ? (
              <button
                type="button"
                onClick={() => void sendOtp()}
                disabled={loading}
                className="w-full py-3 rounded-xl bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <ArrowRight className="w-4 h-4" />
                {loading ? 'Sending…' : 'Send code'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void verifyOtp()}
                disabled={loading}
                className="w-full py-3 rounded-xl bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? 'Verifying…' : 'Verify & continue'}
              </button>
            )}
          </div>

          <p className="text-[11px] text-[var(--color-brand-text-muted)] text-center">
            By continuing you agree to store your budget data in your private account.
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
