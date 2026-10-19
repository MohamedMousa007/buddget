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

interface Unlocked { token: string; expiresAt: string }

/** Shown when the person turned off "stay unlocked with Buddget sign-in": admin password + emailed code, or biometrics. */
export function UnlockScreen({ name, email, biometricEnrolled, onUnlocked }: { name: string; email: string; biometricEnrolled: boolean; onUnlocked: () => void }) {
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

  const finish = useCallback((res: Unlocked) => {
    setAdminToken(res.token)
    onUnlocked()
  }, [onUnlocked])

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      finish(await adminPost<Unlocked>('/api/admin/auth/login', { password, code }))
    } catch (e) {
      setError(errorMessage(e))
      setCode('')
    } finally {
      setBusy(false)
    }
  }

  const biometric = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const secret = await readAdminSecretWithBiometric()
      if (!secret) throw new Error('Biometric unlock is not set up on this device. Use your password.')
      finish(await adminPost<Unlocked>('/api/admin/auth/biometric', { secret }))
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

  return (
    <AuthFrame title={`Welcome back${name ? `, ${name.split(' ')[0]}` : ''}`} subtitle="Unlock the portal with your admin password and the code we email you." account={email}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void submit() }}>
        {canBiometric ? (
          <>
            <Button type="button" variant="outline" size="cta-block" onClick={() => void biometric()} disabled={busy}><Fingerprint />Unlock with biometrics</Button>
            <p className="text-center text-xs text-[var(--color-brand-text-muted)]">or use your password</p>
          </>
        ) : null}
        <Field label="Admin password">
          <Input size="brand" type="password" autoComplete="current-password" autoFocus={!canBiometric} value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <EmailCodeInput value={code} onChange={setCode} email={email} disabled={busy} />
        {error ? <Notice tone="negative">{error}</Notice> : null}
        <Button type="submit" size="cta-block" loading={busy} disabled={!password || code.replace(/\D/g, '').length < 6}><Lock />Unlock</Button>
        <AppLink href={`${appOrigin()}/`} className="flex min-h-11 items-center justify-center text-xs text-[var(--color-brand-text-muted)] hover:text-[var(--color-brand-text-secondary)]">← Back to Buddget</AppLink>
      </form>
    </AuthFrame>
  )
}
