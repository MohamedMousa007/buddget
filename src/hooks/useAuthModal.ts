'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { mapAuthError, isValidEmailFormat } from '@/components/auth/authErrors'
import { useAuth } from '@/components/auth/auth-context'
import { APP_CONFIG } from '@/lib/config'
import { routeAfterAuth } from '@/lib/auth/postAuthRedirect'
import { MIN_PASSWORD_LEN } from '@/components/features/auth-modal/authModalTokens'

export type AuthFormMode = 'signin' | 'signup'
export type AuthStep = 'form' | 'verify' | 'forgot'

/**
 * Supabase email/password + OTP + forgot-password flow for the global auth modal.
 */
export function useAuthModal() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { pendingNext, setPendingNext, closeAuthModal, authModalMessage } = useAuth()
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

  const [formMode, setFormMode] = useState<AuthFormMode>('signin')
  const [step, setStep] = useState<AuthStep>('form')
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

  const validateEmailField = useCallback(() => {
    if (!email.trim()) {
      setError('Please enter a valid email address.')
      return false
    }
    if (!isValidEmailFormat(email)) {
      setError('Please enter a valid email address.')
      return false
    }
    return true
  }, [email])

  const signIn = useCallback(async () => {
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
    const { data: userData } = await supabase.auth.getUser()
    router.refresh()
    router.replace(routeAfterAuth(userData.user, safeNext))
  }, [password, router, safeNext, supabase, validateEmailField])

  const signUp = useCallback(async () => {
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
      const { data: userData } = await supabase.auth.getUser()
      router.refresh()
      router.replace(routeAfterAuth(userData.user, safeNext))
      return
    }
    if (data.user) {
      setStep('verify')
      setOtp('')
      startResendCooldown()
      return
    }
    setError('Could not create account. Try again.')
  }, [confirmPassword, password, router, safeNext, startResendCooldown, supabase, validateEmailField])

  const verifySignupOtp = useCallback(async () => {
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
    const { data: userData } = await supabase.auth.getUser()
    router.refresh()
    router.replace(routeAfterAuth(userData.user, safeNext))
  }, [email, otp, router, safeNext, supabase])

  const resendCode = useCallback(async () => {
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
  }, [email, resendCooldown, startResendCooldown, supabase])

  const sendForgot = useCallback(async () => {
    setError('')
    if (!validateEmailField()) return
    setLoading(true)
    const origin =
      typeof window !== 'undefined' ? window.location.origin : APP_CONFIG.url.replace(/\/$/, '')
    const { error: e } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${origin}/auth/callback?next=/reset-password/confirm`,
    })
    setLoading(false)
    if (e) {
      setError(mapAuthError(e, 'forgot'))
      return
    }
    setForgotSuccess(true)
  }, [supabase, validateEmailField])

  const switchToSignIn = useCallback(() => {
    setFormMode('signin')
    setError('')
    setStep('form')
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeAuthModal()
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [closeAuthModal])

  return {
    closeAuthModal,
    authModalMessage,
    formMode,
    setFormMode,
    step,
    setStep,
    email,
    setEmail,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    otp,
    setOtp,
    loading,
    error,
    setError,
    forgotSuccess,
    setForgotSuccess,
    resendCooldown,
    contentKey: `${step}-${formMode}`,
    signIn,
    signUp,
    verifySignupOtp,
    resendCode,
    sendForgot,
    switchToSignIn,
  }
}
