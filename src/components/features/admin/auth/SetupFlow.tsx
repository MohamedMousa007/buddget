'use client'

import { useState } from 'react'
import { Check, Copy, Download, KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Notice } from '../ui/Panel'
import { Field } from '../ui/Field'
import { AdminApiError, adminPost, errorMessage, setAdminToken } from '../adminClient'
import { AuthFrame } from './AuthFrame'

type Step = 'password' | 'authenticator' | 'recovery'

interface SetupStart { secret: string; uri: string; qr: string }
interface SetupDone { recoveryCodes: string[]; token: string; expiresAt: string }

/** First-time security: admin password, authenticator app, then one-time recovery codes. */
export function SetupFlow({ hasAccountPassword, email, onDone }: { hasAccountPassword: boolean; email: string; onDone: () => void }) {
  const [step, setStep] = useState<Step>('password')
  const [accountPassword, setAccountPassword] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [code, setCode] = useState('')
  const [start, setStart] = useState<SetupStart | null>(null)
  const [codes, setCodes] = useState<string[]>([])
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)
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
      setStart(await adminPost<SetupStart>('/api/admin/auth/setup', { password, accountPassword }))
      setStep('authenticator')
    })

  const submitCode = () =>
    run(async () => {
      const done = await adminPost<SetupDone>('/api/admin/auth/setup/confirm', { code })
      setAdminToken(done.token)
      setCodes(done.recoveryCodes)
      setStep('recovery')
    })

  const copyCodes = async () => {
    await navigator.clipboard.writeText(codes.join('\n'))
    setCopied(true)
  }

  const downloadCodes = () => {
    const url = URL.createObjectURL(new Blob([`Buddget admin recovery codes for ${email}\nEach code works once.\n\n${codes.join('\n')}\n`], { type: 'text/plain' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'buddget-admin-recovery-codes.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  if (step === 'password') {
    return (
      <AuthFrame title="Secure your access" subtitle="Two quick steps protect the portal: a password and an authenticator app.">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void submitPassword() }}>
          {hasAccountPassword ? (
            <Field label="Your Buddget account password" hint="Confirms this is really you before we create admin credentials.">
              <Input size="brand" type="password" autoComplete="current-password" value={accountPassword} onChange={(e) => setAccountPassword(e.target.value)} />
            </Field>
          ) : null}
          <Field label="New admin password" hint="12+ characters with upper case, lower case and a number. Use something unique.">
            <Input size="brand" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Field label="Confirm admin password">
            <Input size="brand" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </Field>
          {error ? <Notice tone="negative">{error}</Notice> : null}
          <Button type="submit" size="cta-block" loading={busy} disabled={!password || !confirm || (hasAccountPassword && !accountPassword)}>Continue</Button>
        </form>
      </AuthFrame>
    )
  }

  if (step === 'authenticator' && start) {
    return (
      <AuthFrame title="Add your authenticator" subtitle="Scan with Google Authenticator, 1Password, Authy or any TOTP app." wide>
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
            {/* eslint-disable-next-line @next/next/no-img-element -- generated data URL */}
            <img src={start.qr} alt="Authenticator QR code" width={192} height={192} className="rounded-xl border border-[var(--color-brand-border)] bg-white p-2" />
            <div className="min-w-0 space-y-2 text-sm text-[var(--color-brand-text-secondary)]">
              <p>Can’t scan? Enter this key manually (time-based, 6 digits):</p>
              <code className="block break-all rounded-lg bg-[var(--color-brand-elevated)] px-3 py-2 font-mono-numbers text-xs text-[var(--color-brand-text-primary)] select-text">{start.secret}</code>
              <a href={start.uri} className="inline-block text-[var(--color-brand-primary-ink)] underline">Open in authenticator app</a>
            </div>
          </div>
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void submitCode() }}>
            <Field label="Enter the 6-digit code to confirm">
              <Input size="brand" inputMode="numeric" autoComplete="one-time-code" autoFocus value={code} onChange={(e) => setCode(e.target.value)} className="text-center font-mono-numbers tracking-[0.3em]" />
            </Field>
            {error ? <Notice tone="negative">{error}</Notice> : null}
            <Button type="submit" size="cta-block" loading={busy} disabled={code.replace(/\s/g, '').length < 6}>Verify and continue</Button>
          </form>
        </div>
      </AuthFrame>
    )
  }

  return (
    <AuthFrame title="Save your recovery codes" subtitle="If you lose your phone, each code gets you in once. They’re shown only now." wide>
      <div className="space-y-4">
        <ul className="grid grid-cols-2 gap-2 rounded-xl bg-[var(--color-brand-elevated)] p-4 font-mono-numbers text-sm text-[var(--color-brand-text-primary)] select-text">
          {codes.map((c) => <li key={c}>{c}</li>)}
        </ul>
        <div className="flex gap-2">
          <Button variant="outline" size="touch" className="flex-1" onClick={() => void copyCodes()}>{copied ? <Check /> : <Copy />}{copied ? 'Copied' : 'Copy'}</Button>
          <Button variant="outline" size="touch" className="flex-1" onClick={downloadCodes}><Download />Download</Button>
        </div>
        <label className="flex items-start gap-2.5 text-sm text-[var(--color-brand-text-secondary)]">
          <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} className="mt-0.5 size-4 accent-[var(--color-brand-primary)]" />
          I’ve stored these somewhere safe, like a password manager.
        </label>
        <Button size="cta-block" disabled={!saved} onClick={onDone}><KeyRound />Enter the portal</Button>
      </div>
    </AuthFrame>
  )
}
