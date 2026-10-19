'use client'

import { useState } from 'react'
import { KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Notice } from '../ui/Panel'
import { Field } from '../ui/Field'
import { AdminApiError, adminPost, errorMessage, setAdminToken } from '../adminClient'
import { AuthFrame } from './AuthFrame'
import { EmailCodeInput } from './EmailCodeInput'

type Step = 'password' | 'code'

/** First-time security: an admin password of its own, confirmed by a code emailed to the account. */
export function SetupFlow({ email, resume, onDone }: { email: string; resume: boolean; onDone: () => void }) {
  const [step, setStep] = useState<Step>(resume ? 'code' : 'password')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const submitPassword = () =>
    run(async () => {
      if (password !== confirm) throw new Error('The two passwords do not match.')
      await adminPost('/api/admin/auth/setup', { password })
      setSent(true)
      setStep('code')
    })

  const submitCode = () =>
    run(async () => {
      const done = await adminPost<{ token: string }>('/api/admin/auth/setup/confirm', { code })
      setAdminToken(done.token)
      onDone()
    })

  if (step === 'password') {
    return (
      <AuthFrame title="Secure your access" subtitle="One-time setup. Choose a password for the admin portal, separate from your Buddget one. After this, being signed in to Buddget opens it." account={email}>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void submitPassword() }}>
          <Field label="New admin password" hint="12+ characters with upper case, lower case and a number. Use something unique.">
            <Input size="brand" type="password" autoComplete="new-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Field label="Confirm admin password">
            <Input size="brand" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </Field>
          {error ? <Notice tone="negative">{error}</Notice> : null}
          <Button type="submit" size="cta-block" loading={busy} disabled={!password || !confirm}>Continue</Button>
        </form>
      </AuthFrame>
    )
  }

  return (
    <AuthFrame title="Check your inbox" subtitle="Enter the code we emailed you to confirm it is really you." account={email}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void submitCode() }}>
        <EmailCodeInput value={code} onChange={setCode} email={email} alreadySent={sent} disabled={busy} />
        {error ? <Notice tone="negative">{error}</Notice> : null}
        <Button type="submit" size="cta-block" loading={busy} disabled={code.replace(/\D/g, '').length < 6}><KeyRound />Enter the portal</Button>
        <Button type="button" variant="ghost" size="touch" className="w-full" onClick={() => { setStep('password'); setCode('') }}>Change password</Button>
      </form>
    </AuthFrame>
  )
}
