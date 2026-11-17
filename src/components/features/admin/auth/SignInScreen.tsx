'use client'

import { useCallback, useEffect, useState } from 'react'
import { Fingerprint, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AppLink } from '@/components/ui/AppLink'
import { appOrigin } from '@/lib/apiBase'
import { adminBiometricSupported, readAdminSecretWithBiometric } from '@/lib/native/adminBiometric'
import { Notice } from '../ui/Panel'
import { Field } from '../ui/Field'
import { adminPost, errorMessage, setAdminToken } from '../adminClient'
import { AuthFrame } from './AuthFrame'
import { EmailCodeInput } from './EmailCodeInput'

interface SignedIn { token: string; expiresAt: string }

/**
 * The portal's own sign-in: staff email and admin password, then the code emailed to that address (or biometrics on
 * an enrolled phone). Being signed in to the buddget app does not open the portal.
 */
export function SignInScreen({ biometricEnrolled, onSignedIn, onSetup }: { biometricEnrolled: boolean; onSignedIn: () => void; onSetup: () => void }) {
  const [step, setStep] = useState<'details' | 'code'>('details')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [canBiometric, setCanBiometric] = useState(false)

  useEffect(() => {
    let live = true
    void adminBiometricSupported().then((ok) => live && setCanBiometric(ok && biometricEnrolled))
    return () => { live = false }
  }, [biometricEnrolled])

  const finish = useCallback((res: SignedIn) => {
    setAdminToken(res.token)
    onSignedIn()
  }, [onSignedIn])

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const sendCode = () => run(async () => {
    await adminPost('/api/admin/auth/code', { email, password })
    setCode('')
    setStep('code')
  })

  const signIn = () => run(async () => {
    try {
      finish(await adminPost<SignedIn>('/api/admin/auth/login', { email, password, code }))
    } catch (e) {
      setCode('')
      throw e
    }
  })

  const biometric = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const secret = await readAdminSecretWithBiometric()
      if (!secret) throw new Error('Biometric unlock is not set up on this device. Use your password.')
      finish(await adminPost<SignedIn>('/api/admin/auth/biometric', { secret }))
    } catch (e) {
      const msg = errorMessage(e)
      if (!/cancel/i.test(msg)) setError(msg)
    } finally {
      setBusy(false)
    }
  }, [finish])

  useEffect(() => {
    if (canBiometric) void biometric()
  }, [canBiometric, biometric])

  if (step === 'code') {
    return (
      <AuthFrame title="Check your inbox" subtitle="Enter the code we emailed you to finish signing in.">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void signIn() }}>
          <EmailCodeInput value={code} onChange={setCode} email={email} alreadySent disabled={busy} body={{ email, password }} />
          {error ? <Notice tone="negative">{error}</Notice> : null}
          <Button type="submit" size="cta-block" loading={busy} disabled={code.replace(/\D/g, '').length < 6}><Lock />Sign in</Button>
          <Button type="button" variant="ghost" size="touch" className="w-full" onClick={() => { setStep('details'); setError(null) }}>Use a different email or password</Button>
        </form>
      </AuthFrame>
    )
  }

  return (
    <AuthFrame title="Sign in to the portal" subtitle="Use your staff email and your admin password. We then email you a code.">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void sendCode() }}>
        {canBiometric ? (
          <>
            <Button type="button" variant="outline" size="cta-block" onClick={() => void biometric()} disabled={busy}><Fingerprint />Sign in with biometrics</Button>
            <p className="text-center text-xs text-[var(--color-brand-text-muted)]">or use your password</p>
          </>
        ) : null}
        <Field label="Staff email">
          <Input size="brand" type="email" inputMode="email" autoComplete="username" autoCapitalize="none" autoFocus={!canBiometric} value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Admin password">
          <Input size="brand" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {error ? <Notice tone="negative">{error}</Notice> : null}
        <Button type="submit" size="cta-block" loading={busy} disabled={!email.trim() || !password}>Continue</Button>
        <Button type="button" variant="ghost" size="touch" className="w-full" onClick={onSetup}>First time here? Set up your access</Button>
        <AppLink href={`${appOrigin()}/`} className="flex min-h-11 items-center justify-center text-xs text-[var(--color-brand-text-muted)] hover:text-[var(--color-brand-text-secondary)]">← Back to buddget</AppLink>
      </form>
    </AuthFrame>
  )
}
