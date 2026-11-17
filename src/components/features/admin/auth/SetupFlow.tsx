'use client'

import { useState } from 'react'
import { KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Notice } from '../ui/Panel'
import { Field } from '../ui/Field'
import { adminPost, errorMessage, setAdminToken } from '../adminClient'
import { AuthFrame } from './AuthFrame'
import { EmailCodeInput } from './EmailCodeInput'

const SETUP = '/api/admin/auth/setup'

/** First-time access: a code emailed to the staff address proves it is you, then you choose an admin password of its own. */
export function SetupFlow({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const [step, setStep] = useState<'email' | 'finish'>('email')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  const start = () => run(async () => {
    await adminPost(SETUP, { email })
    setStep('finish')
  })

  const finish = () => run(async () => {
    if (password !== confirm) throw new Error('The two passwords do not match.')
    const done = await adminPost<{ token: string }>(`${SETUP}/confirm`, { email, code, password })
    setAdminToken(done.token)
    onDone()
  })

  if (step === 'email') {
    return (
      <AuthFrame title="Set up your access" subtitle="One-time setup for people on the buddget team. Enter the email you were invited with and we send it a code.">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void start() }}>
          <Field label="Staff email">
            <Input size="brand" type="email" inputMode="email" autoComplete="username" autoCapitalize="none" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          {error ? <Notice tone="negative">{error}</Notice> : null}
          <Button type="submit" size="cta-block" loading={busy} disabled={!email.trim()}>Email me a code</Button>
          <Button type="button" variant="ghost" size="touch" className="w-full" onClick={onBack}>Already set up? Sign in</Button>
        </form>
      </AuthFrame>
    )
  }

  return (
    <AuthFrame title="Check your inbox" subtitle="If this email is on the team and not set up yet, a code is on its way. Enter it and choose your admin password.">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void finish() }}>
        <EmailCodeInput value={code} onChange={setCode} email={email} alreadySent disabled={busy} request={SETUP} body={{ email }} />
        <Field label="New admin password" hint="12+ characters with upper case, lower case and a number. Use something unique, not your buddget password.">
          <Input size="brand" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field label="Confirm admin password">
          <Input size="brand" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
        {error ? <Notice tone="negative">{error}</Notice> : null}
        <Button type="submit" size="cta-block" loading={busy} disabled={code.replace(/\D/g, '').length < 6 || !password || !confirm}><KeyRound />Enter the portal</Button>
        <Button type="button" variant="ghost" size="touch" className="w-full" onClick={onBack}>Already set up? Sign in</Button>
      </form>
    </AuthFrame>
  )
}
