'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertCircle, Loader2, Lock, Mail } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { mapAuthError, isValidEmailFormat } from '@/components/auth/authErrors'
import { useAuth } from '@/components/auth/auth-context'
import { AUTH_REDIRECTS } from '@/lib/config'
import { cn } from '@/lib/utils'

const MIN_PASSWORD_LEN = 8

const cardStyle: React.CSSProperties = {
  background: '#111118',
  borderColor: '#2A2A38',
  borderRadius: 16,
  maxWidth: 440,
}

const inputClass =
  'w-full h-12 px-3 rounded-[10px] border text-white placeholder:text-[#5A5A72] outline-none transition-colors text-[15px]'
const inputStyle: React.CSSProperties = {
  background: '#1A1A24',
  borderColor: '#2A2A38',
}
const inputFocus =
  'focus:border-[#E50914] focus:ring-1 focus:ring-[#E50914]'

const primaryBtn =
  'w-full h-12 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'

function OtpRow({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (six: string) => void
  disabled?: boolean
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([])
  const digitsOnly = value.replace(/\D/g, '').slice(0, 6)
  const chars = (digitsOnly + '      ').slice(0, 6).split('')

  const setDigit = (i: number, raw: string) => {
    const digit = raw.replace(/\D/g, '').slice(-1)
    const padded = (digitsOnly + '      ').slice(0, 6).split('')
    padded[i] = digit || ' '
    const next = padded.join('').replace(/ /g, '')
    onChange(next)
    if (digit && i < 5) refs.current[i + 1]?.focus()
  }

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Backspace') return
    const v = digitsOnly
    if (v[i]) {
      onChange(v.slice(0, i) + v.slice(i + 1))
    } else if (i > 0) {
      refs.current[i - 1]?.focus()
      onChange(v.slice(0, i - 1) + v.slice(i))
    }
    e.preventDefault()
  }

  const onPaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const t = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    onChange(t)
    refs.current[Math.min(t.length, 5)]?.focus()
  }

  return (
    <div className="flex justify-center gap-2 sm:gap-2.5" onPaste={onPaste}>
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          disabled={disabled}
          maxLength={1}
          value={chars[i]?.trim() ? chars[i] : ''}
          onChange={(e) => setDigit(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          className={cn(
            'w-12 h-14 sm:w-12 rounded-[10px] border text-center text-2xl outline-none transition-colors disabled:opacity-50',
            inputFocus
          )}
          style={{
            ...inputStyle,
            fontFamily: 'var(--font-mono), ui-monospace, monospace',
          }}
        />
      ))}
    </div>
  )
}

type FormMode = 'signin' | 'signup'
type Step = 'form' | 'verify' | 'forgot'

export function AuthModal() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { pendingNext, setPendingNext } = useAuth()
  const supabase = useMemo(() => createClient(), [])

  const nextFromUrl = searchParams.get('next')
  useEffect(() => {
    if (nextFromUrl && nextFromUrl.startsWith('/') && !nextFromUrl.startsWith('//')) {
      setPendingNext(nextFromUrl)
    }
  }, [nextFromUrl, setPendingNext])

  const safeNext = useMemo(() => {
    const n = pendingNext || nextFromUrl || '/'
    return n.startsWith('/') && !n.startsWith('//') ? n : '/'
  }, [pendingNext, nextFromUrl])

  const [formMode, setFormMode] = useState<FormMode>('signin')
  const [step, setStep] = useState<Step>('form')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [forgotSuccess, setForgotSuccess] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = window.setInterval(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000)
    return () => window.clearInterval(t)
  }, [resendCooldown])

  const startResendCooldown = useCallback(() => setResendCooldown(60), [])

  const validateEmailField = () => {
    if (!email.trim()) {
      setError('Please enter a valid email address.')
      return false
    }
    if (!isValidEmailFormat(email)) {
      setError('Please enter a valid email address.')
      return false
    }
    return true
  }

  const signIn = async () => {
    setError('')
    if (!validateEmailField()) return
    if (!password) {
      setError('Enter your email and password.')
      return
    }
    setLoading(true)
    const { error: e } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    setLoading(false)
    if (e) {
      setError(mapAuthError(e, 'signin'))
      return
    }
    router.refresh()
    router.replace(safeNext)
  }

  const signUp = async () => {
    setError('')
    if (!validateEmailField()) return
    if (password.length < MIN_PASSWORD_LEN) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    const { data, error: e } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: undefined,
      },
    })
    setLoading(false)
    if (e) {
      const mapped = mapAuthError(e, 'signup')
      if (mapped === 'EMAIL_EXISTS') {
        setError('An account with this email already exists. Sign in instead?')
        return
      }
      setError(mapped)
      return
    }
    if (data.session) {
      router.refresh()
      router.replace(safeNext)
      return
    }
    if (data.user) {
      setStep('verify')
      setOtp('')
      startResendCooldown()
      return
    }
    setError('Could not create account. Try again.')
  }

  const verifySignupOtp = async () => {
    setError('')
    const token = otp.replace(/\D/g, '').slice(0, 6)
    if (token.length !== 6) {
      setError('Enter the full 6-digit code.')
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
      setError(mapAuthError(e, 'otp'))
      return
    }
    router.refresh()
    router.replace(safeNext)
  }

  const resendCode = async () => {
    if (resendCooldown > 0) return
    setError('')
    setLoading(true)
    const { error: e } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
    })
    setLoading(false)
    if (e) {
      setError(mapAuthError(e, 'resend'))
      return
    }
    startResendCooldown()
  }

  const sendForgot = async () => {
    setError('')
    if (!validateEmailField()) return
    setLoading(true)
    const { error: e } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: AUTH_REDIRECTS.passwordReset,
    })
    setLoading(false)
    if (e) {
      setError(mapAuthError(e, 'forgot'))
      return
    }
    setForgotSuccess(true)
  }

  const switchToSignIn = () => {
    setFormMode('signin')
    setError('')
    setStep('form')
  }

  const contentKey = `${step}-${formMode}`

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="w-full border p-6 sm:p-8 shadow-2xl"
        style={cardStyle}
      >
        <div className="text-center mb-6">
          <h1 id="auth-modal-title" className="text-2xl font-extrabold tracking-tight" style={{ fontFamily: 'var(--font-heading), var(--font-sans)' }}>
            <span className="text-white">Bud</span>
            <span className="text-[#E50914]">d</span>
            <span className="text-white">get</span>
          </h1>
          <p className="text-sm mt-1 text-[#5A5A72]">Your money, finally makes sense</p>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={contentKey}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            {step === 'forgot' ? (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-white text-center">Reset password</h2>
                {forgotSuccess ? (
                  <p className="text-sm text-center text-[#5A5A72]">Reset link sent — check your email</p>
                ) : (
                  <>
                    <div>
                      <label className="text-xs text-[#5A5A72] mb-1 block">Email</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5A5A72]" />
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className={cn(inputClass, inputFocus, 'pl-10')}
                          style={inputStyle}
                          placeholder="you@example.com"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void sendForgot()}
                      disabled={loading}
                      className={primaryBtn}
                      style={{ background: '#E50914' }}
                      onMouseEnter={(e) => {
                        if (!loading) (e.target as HTMLButtonElement).style.background = '#F40612'
                      }}
                      onMouseLeave={(e) => {
                        (e.target as HTMLButtonElement).style.background = '#E50914'
                      }}
                    >
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Send reset link'}
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setStep('form')
                    setForgotSuccess(false)
                    setError('')
                  }}
                  className="w-full text-sm text-[#5A5A72] hover:text-white"
                >
                  Back to sign in
                </button>
              </div>
            ) : step === 'verify' ? (
              <div className="space-y-5">
                <div className="text-center">
                  <h2 className="text-lg font-semibold text-white">Check your email</h2>
                  <p className="text-sm text-[#5A5A72] mt-1">
                    We sent a 6-digit code to <span className="text-white">{email}</span>
                  </p>
                </div>
                <OtpRow value={otp} onChange={setOtp} disabled={loading} />
                <button
                  type="button"
                  onClick={() => void verifySignupOtp()}
                  disabled={loading}
                  className={primaryBtn}
                  style={{ background: '#E50914' }}
                  onMouseEnter={(e) => {
                    if (!loading) (e.target as HTMLButtonElement).style.background = '#F40612'
                  }}
                  onMouseLeave={(e) => {
                    (e.target as HTMLButtonElement).style.background = '#E50914'
                  }}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Verifying…</span>
                    </>
                  ) : (
                    'Confirm & continue'
                  )}
                </button>
                <div className="flex flex-col items-center gap-2 text-sm">
                  <button
                    type="button"
                    disabled={resendCooldown > 0 || loading}
                    onClick={() => void resendCode()}
                    className="text-[#E50914] disabled:opacity-50 disabled:cursor-not-allowed hover:underline"
                  >
                    {resendCooldown > 0 ? `Resend code (${resendCooldown}s)` : 'Resend code'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStep('form')
                      setFormMode('signup')
                      setOtp('')
                      setError('')
                    }}
                    className="text-[#5A5A72] hover:text-white"
                  >
                    Use a different email
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex rounded-xl border p-1" style={{ background: '#1A1A24', borderColor: '#2A2A38' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setFormMode('signin')
                      setError('')
                    }}
                    className={cn(
                      'flex-1 py-2 rounded-lg text-sm font-semibold transition-colors',
                      formMode === 'signin' ? 'text-white' : 'text-[#5A5A72]'
                    )}
                    style={formMode === 'signin' ? { background: '#E50914' } : {}}
                  >
                    Sign in
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFormMode('signup')
                      setError('')
                    }}
                    className={cn(
                      'flex-1 py-2 rounded-lg text-sm font-semibold transition-colors',
                      formMode === 'signup' ? 'text-white' : 'text-[#5A5A72]'
                    )}
                    style={formMode === 'signup' ? { background: '#E50914' } : {}}
                  >
                    Sign up
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-[#5A5A72] mb-1 block">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5A5A72]" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={cn(inputClass, inputFocus, 'pl-10')}
                        style={inputStyle}
                        placeholder="you@example.com"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-[#5A5A72] mb-1 block">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5A5A72]" />
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && void (formMode === 'signin' ? signIn() : signUp())}
                        className={cn(inputClass, inputFocus, 'pl-10')}
                        style={inputStyle}
                        placeholder="••••••••"
                      />
                    </div>
                    {formMode === 'signin' ? (
                      <button
                        type="button"
                        onClick={() => {
                          setStep('forgot')
                          setForgotSuccess(false)
                          setError('')
                        }}
                        className="mt-2 text-xs text-[#E50914] hover:underline"
                      >
                        Forgot password?
                      </button>
                    ) : null}
                  </div>
                  {formMode === 'signup' ? (
                    <div>
                      <label className="text-xs text-[#5A5A72] mb-1 block">Confirm password</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5A5A72]" />
                        <input
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && void signUp()}
                          className={cn(inputClass, inputFocus, 'pl-10')}
                          style={inputStyle}
                          placeholder="••••••••"
                        />
                      </div>
                    </div>
                  ) : null}
                </div>

                <AnimatePresence>
                  {error ? (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex items-start gap-2 text-sm text-[#E50914]"
                    >
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>
                        {error}
                        {error.includes('Sign in instead?') ? (
                          <>
                            {' '}
                            <button
                              type="button"
                              className="underline font-medium"
                              onClick={() => {
                                switchToSignIn()
                                setError('')
                              }}
                            >
                              Sign in instead
                            </button>
                          </>
                        ) : null}
                        {error.includes('Resend confirmation code?') ? (
                          <>
                            {' '}
                            <button
                              type="button"
                              className="underline font-medium"
                              onClick={() => void resendCode()}
                            >
                              Resend code
                            </button>
                          </>
                        ) : null}
                      </span>
                    </motion.div>
                  ) : null}
                </AnimatePresence>

                <button
                  type="button"
                  onClick={() => void (formMode === 'signin' ? signIn() : signUp())}
                  disabled={loading}
                  className={primaryBtn}
                  style={{ background: '#E50914' }}
                  onMouseEnter={(e) => {
                    if (!loading) (e.target as HTMLButtonElement).style.background = '#F40612'
                  }}
                  onMouseLeave={(e) => {
                    (e.target as HTMLButtonElement).style.background = '#E50914'
                  }}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>{formMode === 'signin' ? 'Signing in...' : 'Creating account...'}</span>
                    </>
                  ) : formMode === 'signin' ? (
                    'Sign in'
                  ) : (
                    'Create account'
                  )}
                </button>

                <p className="text-center text-sm text-[#5A5A72]">
                  {formMode === 'signin' ? (
                    <>
                      Don&apos;t have an account?{' '}
                      <button
                        type="button"
                        className="text-[#E50914] font-medium hover:underline"
                        onClick={() => {
                          setFormMode('signup')
                          setError('')
                        }}
                      >
                        Sign up
                      </button>
                    </>
                  ) : (
                    <>
                      Already have an account?{' '}
                      <button
                        type="button"
                        className="text-[#E50914] font-medium hover:underline"
                        onClick={() => {
                          setFormMode('signin')
                          setError('')
                        }}
                      >
                        Sign in
                      </button>
                    </>
                  )}
                </p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
