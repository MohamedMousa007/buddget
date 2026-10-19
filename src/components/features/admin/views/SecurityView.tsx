'use client'

import { useEffect, useState } from 'react'
import { Fingerprint, KeyRound, LogOut, Monitor } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useActionToast } from '@/components/ui/ActionToast'
import { Switch } from '@/components/ui/switch'
import { useConfirm } from '@/components/ui/dialog/DialogProvider'
import { isAndroid } from '@/lib/native/isNative'
import { adminBiometricSupported, clearLocalAdminSecret, hasLocalAdminSecret, prepareAdminBiometric } from '@/lib/native/adminBiometric'
import { adminFetch, adminPost, errorMessage, useAdminQuery } from '../adminClient'
import { ago, dateTime } from '../format'
import { AdminSheet } from '../ui/AdminSheet'
import { EmailCodeInput } from '../auth/EmailCodeInput'
import { Field } from '../ui/Field'
import { KeyValue, Loading, Notice, PageHeader, Panel } from '../ui/Panel'
import { Pill } from '../ui/Pill'
import { useStepUp } from '../ui/StepUp'
import type { AdminStatus } from '../types'

interface SecurityData {
  sessions: Array<{ id: string; method: string; ip: string | null; user_agent: string | null; created_at: string; last_seen_at: string; expires_at: string; current: boolean }>
  devices: Array<{ device_id: string; label: string | null; platform: string | null; created_at: string; last_used_at: string | null; current: boolean }>
  ssoEnabled: boolean
  passwordChangedAt: string | null
}

const METHOD_LABEL: Record<string, string> = { password_email: 'Password + emailed code', sso: 'Buddget sign-in', biometric: 'Biometric', password_totp: 'Password + authenticator (retired)', recovery: 'Recovery code (retired)' }

export default function SecurityView({ status }: { status: AdminStatus }) {
  const { data, error, refresh } = useAdminQuery<SecurityData>('/api/admin/auth/sessions')
  const toast = useActionToast()
  const confirm = useConfirm()
  const stepUp = useStepUp()
  const [sheet, setSheet] = useState<'password' | null>(null)
  const [nativeBio, setNativeBio] = useState(false)
  const [localSecret, setLocalSecret] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    void adminBiometricSupported().then(setNativeBio)
    void hasLocalAdminSecret().then(setLocalSecret)
  }, [])

  const act = async (key: string, fn: () => Promise<void | false>, ok: string) => {
    setBusy(key)
    try { if ((await fn()) === false) return; toast(ok); await refresh() } catch (e) { toast(errorMessage(e)) } finally { setBusy(null) }
  }

  const enroll = () => act('enroll', async () => {
    const { secretHash, commit } = await prepareAdminBiometric()
    await adminPost('/api/admin/auth/biometric/device', { secretHash, label: isAndroid() ? 'Android device' : 'iPhone / iPad', platform: isAndroid() ? 'android' : 'ios' })
    await commit()
    setLocalSecret(true)
  }, 'Biometric unlock enabled on this device')

  const removeDevice = (deviceId: string, current: boolean) => act('rm', async () => {
    await adminFetch(`/api/admin/auth/biometric/device?deviceId=${encodeURIComponent(deviceId)}`, { method: 'DELETE' })
    if (current) { await clearLocalAdminSecret(); setLocalSecret(false) }
  }, 'Biometric device removed')

  const setSso = (enabled: boolean) => act('sso', async () => {
    if (enabled) {
      const proof = await stepUp('Staying unlocked with your Buddget sign-in makes the portal easier to open. Confirm it’s you to turn it on.')
      if (!proof) return false
      await adminPost('/api/admin/auth/sso', { enabled, ...proof })
      return
    }
    if (!(await confirm({ title: 'Ask for the password and a code again?', body: 'The portal locks right away and needs your admin password and an emailed code (or biometrics) to open.', confirmLabel: 'Turn off' }))) return false
    await adminPost('/api/admin/auth/sso', { enabled })
  }, enabled ? 'Portal now stays unlocked while you are signed in' : 'Portal now needs your password and a code')

  if (error && !data) return <Notice tone="negative">{error}</Notice>
  if (!data) return <Loading rows={6} />
  const currentEnrolled = data.devices.some((d) => d.current)

  return (
    <>
      <PageHeader title="My security" description={`${status.staff?.email} · ${status.staff?.roleName}`} />
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Sign-in protection" description="How the portal opens for you">
          <div className="flex items-start gap-3 pb-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[var(--color-brand-text-primary)]">Stay unlocked while signed in to Buddget</p>
              <p className="text-xs text-[var(--color-brand-text-muted)]">On: the portal opens with your Buddget sign-in and closes when you sign out of Buddget. Off: it asks for your admin password and an emailed code (or biometrics).</p>
            </div>
            <Switch size="touch" aria-label="Stay unlocked while signed in to Buddget" checked={data.ssoEnabled} disabled={busy === 'sso'} onCheckedChange={(v) => void setSso(v)} />
          </div>
          <dl className="divide-y divide-[var(--color-brand-border)] border-t border-[var(--color-brand-border)]">
            <KeyValue label="Admin password">Changed {ago(data.passwordChangedAt)}</KeyValue>
            <KeyValue label="Second step"><Pill tone="good">Emailed code</Pill></KeyValue>
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" size="touch" onClick={() => setSheet('password')}><KeyRound />Change password</Button>
          </div>
        </Panel>

        <Panel title="Biometric unlock" description="Face ID, Touch ID or fingerprint on your phone, instead of typing a password and code">
          {nativeBio ? (
            <div className="space-y-4">
              {currentEnrolled && localSecret ? <Notice tone="positive">Enabled on this device.</Notice> : <p className="text-sm text-[var(--color-brand-text-secondary)]">Enable it here and the portal unlocks with your biometrics on this phone. It still needs your Buddget sign-in, and your password + emailed code remain the fallback.</p>}
              {!currentEnrolled || !localSecret ? <Button size="touch" loading={busy === 'enroll'} onClick={() => void enroll()}><Fingerprint />Enable on this device</Button> : null}
            </div>
          ) : <p className="text-sm text-[var(--color-brand-text-secondary)]">Biometric unlock is available in the Buddget iOS and Android apps. Open the portal there to enable it.</p>}
          {data.devices.length > 0 ? (
            <ul className="mt-4 divide-y divide-[var(--color-brand-border)]">
              {data.devices.map((d) => (
                <li key={d.device_id} className="flex items-center gap-3 py-3 text-sm">
                  <Fingerprint className="size-4 text-[var(--color-brand-text-muted)]" aria-hidden />
                  <div className="min-w-0 flex-1"><p className="truncate">{d.label ?? d.platform ?? 'Device'}{d.current ? <span className="ms-2"><Pill tone="brand">This device</Pill></span> : null}</p><p className="text-xs text-[var(--color-brand-text-muted)]">Added {ago(d.created_at)} · used {ago(d.last_used_at)}</p></div>
                  <Button variant="ghost" size="touch" loading={busy === 'rm'} onClick={() => void removeDevice(d.device_id, d.current)}>Remove</Button>
                </li>
              ))}
            </ul>
          ) : null}
        </Panel>

        <Panel title="Active sessions" description="Everywhere you’re unlocked right now" className="xl:col-span-2"
          actions={data.sessions.length > 1 ? <Button variant="outline" size="touch" loading={busy === 'all'} onClick={async () => { if (await confirm({ title: 'Sign out everywhere else?', body: 'Every other session is locked immediately.', destructive: true, confirmLabel: 'Sign out others' })) void act('all', () => adminFetch('/api/admin/auth/sessions', { method: 'DELETE', json: { all: true } }).then(() => undefined), 'Other sessions signed out') }}><LogOut />Sign out others</Button> : undefined}>
          <ul className="divide-y divide-[var(--color-brand-border)]">
            {data.sessions.map((s) => (
              <li key={s.id} className="flex items-center gap-3 py-3 text-sm">
                <Monitor className="size-4 shrink-0 text-[var(--color-brand-text-muted)]" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">{METHOD_LABEL[s.method] ?? s.method}{s.current ? <Pill tone="brand">This session</Pill> : null}</p>
                  <p className="truncate text-xs text-[var(--color-brand-text-muted)]">{s.ip ?? 'unknown ip'} · {s.user_agent?.slice(0, 70) ?? 'unknown device'} · started {dateTime(s.created_at)} · active {ago(s.last_seen_at)}</p>
                </div>
                {!s.current ? <Button variant="ghost" size="touch" loading={busy === s.id} onClick={() => void act(s.id, () => adminFetch('/api/admin/auth/sessions', { method: 'DELETE', json: { id: s.id } }).then(() => undefined), 'Session signed out')}>Sign out</Button> : null}
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <PasswordSheet open={sheet === 'password'} onClose={() => setSheet(null)} onDone={refresh} />
    </>
  )
}

function PasswordSheet({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => Promise<void> }) {
  const toast = useActionToast()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <AdminSheet open={open} title="Change admin password" onClose={onClose}>
      <form className="space-y-4" onSubmit={async (e) => {
        e.preventDefault(); setBusy(true); setError(null)
        try { await adminPost('/api/admin/auth/password', { current, next, code }); toast('Password changed — other sessions signed out'); setCurrent(''); setNext(''); setCode(''); onClose(); await onDone() } catch (err) { setError(errorMessage(err)) } finally { setBusy(false) }
      }}>
        <Field label="Current password"><Input size="brand" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} /></Field>
        <Field label="New password" hint="12+ characters, upper and lower case, and a number."><Input size="brand" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} /></Field>
        <EmailCodeInput value={code} onChange={setCode} />
        {error ? <Notice tone="negative">{error}</Notice> : null}
        <Button type="submit" size="cta-block" loading={busy} disabled={!current || !next || code.replace(/\D/g, '').length < 6}>Change password</Button>
      </form>
    </AdminSheet>
  )
}
