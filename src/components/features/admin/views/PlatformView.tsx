'use client'

import { useState } from 'react'
import { CheckCircle2, CircleDashed, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { adminFetch, useAdminQuery } from '../adminClient'
import { useAdminAction } from '../useAdminAction'
import { Field } from '../ui/Field'
import { KeyValue, Loading, Notice, PageHeader, Panel } from '../ui/Panel'
import { Pill } from '../ui/Pill'
import { useActionToast } from '@/components/ui/ActionToast'
import { APP_CLIENT_VERSION } from '@/lib/appVersion'
import { exceedsLatestRelease, LOCK_OUT_CONFIRMATION } from '@/lib/admin/minVersion'
import { useStepUp } from '../ui/StepUp'
import type { AdminStatus } from '../types'

interface AiSlice { rateLimitingEnabled: boolean; rateLimitMaxRequests: number; rateLimitWindowMs: number }
interface PlatformData {
  ai: { keyPresent: boolean; model: string; stored: AiSlice; effective: AiSlice; persistedToDisk: boolean; envHints: Record<string, string | null> }
  services: Array<{ name: string; ok: boolean; optional?: boolean }>
  environment: string
  appUrl: string
  settings: Record<string, { value: Record<string, string | boolean>; updatedAt: string }>
}

const PRESETS: Array<{ label: string; enabled: boolean; max: number; windowSec: number }> = [
  { label: 'Off', enabled: false, max: 15, windowSec: 60 },
  { label: 'Relaxed · 30/min', enabled: true, max: 30, windowSec: 60 },
  { label: 'Standard · 15/min', enabled: true, max: 15, windowSec: 60 },
  { label: 'Strict · 5/min', enabled: true, max: 5, windowSec: 60 },
]

export default function PlatformView({ status }: { status: AdminStatus }) {
  const { data, error, refresh } = useAdminQuery<PlatformData>('/api/admin/platform')
  const canManage = (status.permissions ?? []).some((p) => p === '*' || p === 'platform.manage')
  if (error && !data) return <Notice tone="negative">{error}</Notice>
  if (!data) return <Loading rows={8} />

  return (
    <>
      <PageHeader title="Platform" description="Service connections, AI limits and app-wide switches." />
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Services" description={`${data.environment} · ${data.appUrl}`}>
          <ul className="divide-y divide-[var(--color-brand-border)]">
            {data.services.map((s) => (
              <li key={s.name} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="text-[var(--color-brand-text-primary)]">{s.name}</span>
                <span className="flex items-center gap-1.5 text-xs">
                  {s.ok ? <><CheckCircle2 className="size-4 text-[var(--color-brand-green)]" aria-hidden />Connected</>
                    : s.optional ? <><CircleDashed className="size-4 text-[var(--color-brand-text-muted)]" aria-hidden />Not pinned</>
                    : <><XCircle className="size-4 text-[var(--color-brand-red)]" aria-hidden />Missing</>}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-[var(--color-brand-text-muted)]">Secrets live in the host environment (Vercel) and are never shown here.</p>
        </Panel>

        <AiThrottle data={data} canManage={canManage} onSaved={refresh} />
        <Maintenance data={data} canManage={canManage} onSaved={refresh} />
        <Announcement data={data} canManage={canManage} onSaved={refresh} />
        <MinVersion data={data} canManage={canManage} onSaved={refresh} />
        <Panel title="Per-user AI limit" description="Set per plan or per user, not here">
          <p className="text-sm text-[var(--color-brand-text-secondary)]">The budget planner’s hourly cap comes from each user’s plan and any individual override — see <em>Plans &amp; memberships</em> or a user’s <em>Plan &amp; limits</em> tab. The throttle on this page is a separate per-device guard for the general AI routes.</p>
        </Panel>
      </div>
    </>
  )
}

function AiThrottle({ data, canManage, onSaved }: { data: PlatformData; canManage: boolean; onSaved: () => Promise<void> }) {
  const toast = useActionToast()
  const [enabled, setEnabled] = useState(data.ai.stored.rateLimitingEnabled)
  const [max, setMax] = useState(String(data.ai.stored.rateLimitMaxRequests))
  const [windowSec, setWindowSec] = useState(String(Math.round(data.ai.stored.rateLimitWindowMs / 1000)))
  const [busy, setBusy] = useState(false)
  const env = Object.entries(data.ai.envHints).filter(([, v]) => v !== null)

  const save = async () => {
    setBusy(true)
    try {
      await adminFetch('/api/admin/platform', { method: 'PATCH', json: { aiRuntime: { rateLimitingEnabled: enabled, rateLimitMaxRequests: Math.max(1, Number(max) || 15), rateLimitWindowMs: Math.min(3_600_000, Math.max(1000, (Number(windowSec) || 60) * 1000)) } } })
      toast('AI throttle saved')
      await onSaved()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Panel title="AI throttle" description={`${data.ai.model} · key ${data.ai.keyPresent ? 'present' : 'missing'}`} actions={<Pill tone={data.ai.effective.rateLimitingEnabled ? 'warn' : 'neutral'}>{data.ai.effective.rateLimitingEnabled ? `Active · ${data.ai.effective.rateLimitMaxRequests}/${Math.round(data.ai.effective.rateLimitWindowMs / 1000)}s` : 'Off'}</Pill>}>
      <div className="space-y-4">
        {env.length > 0 ? <Notice tone="warning">Environment variables override these values: {env.map(([k, v]) => `${k}=${v}`).join(', ')}</Notice> : null}
        <div className="flex items-center justify-between"><span className="text-sm">Limit requests per device</span><Switch size="touch" checked={enabled} onCheckedChange={setEnabled} disabled={!canManage} aria-label="Enable AI throttle" /></div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Max requests"><Input size="brand" type="number" value={max} disabled={!canManage || !enabled} onChange={(e) => setMax(e.target.value)} /></Field>
          <Field label="Window (seconds)"><Input size="brand" type="number" value={windowSec} disabled={!canManage || !enabled} onChange={(e) => setWindowSec(e.target.value)} /></Field>
        </div>
        {canManage ? (
          <>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => <Button key={p.label} variant="outline" size="sm" onClick={() => { setEnabled(p.enabled); setMax(String(p.max)); setWindowSec(String(p.windowSec)) }}>{p.label}</Button>)}
            </div>
            <Button size="touch" loading={busy} onClick={() => void save()}>Save throttle</Button>
            {!data.ai.persistedToDisk ? <p className="text-xs text-[var(--color-brand-text-muted)]">On serverless hosting the file may be read-only; if saving fails, set the AI_RATE_LIMIT_* environment variables instead.</p> : null}
          </>
        ) : null}
      </div>
    </Panel>
  )
}

function useSetting(data: PlatformData, key: string, onSaved: () => Promise<void>) {
  const { run, busy } = useAdminAction('/api/admin/platform', onSaved)
  return { value: data.settings[key]?.value ?? {}, busy: busy === key, save: (value: Record<string, unknown>, extra: Record<string, unknown> = {}) => run(key, { op: 'set_setting', key, value, ...extra }, { success: 'Saved' }) }
}

function Maintenance({ data, canManage, onSaved }: { data: PlatformData; canManage: boolean; onSaved: () => Promise<void> }) {
  const s = useSetting(data, 'maintenance', onSaved)
  const [enabled, setEnabled] = useState(s.value.enabled === true)
  const [message, setMessage] = useState(String(s.value.message ?? ''))
  return (
    <Panel title="Maintenance mode" description="Tell the app to show a maintenance notice" actions={<Pill tone={s.value.enabled ? 'bad' : 'good'}>{s.value.enabled ? 'On' : 'Off'}</Pill>}>
      <div className="space-y-4">
        <div className="flex items-center justify-between"><span className="text-sm">Maintenance in progress</span><Switch size="touch" checked={enabled} onCheckedChange={setEnabled} disabled={!canManage} aria-label="Maintenance mode" /></div>
        <Field label="Message shown to users"><Input size="brand" value={message} maxLength={300} onChange={(e) => setMessage(e.target.value)} disabled={!canManage} placeholder="We’re upgrading Buddget. Back in a few minutes." /></Field>
        {canManage ? <Button size="touch" loading={s.busy} onClick={() => void s.save({ enabled, message })}>Save</Button> : null}
        <p className="text-xs text-[var(--color-brand-text-muted)]">Stored now and served from the platform settings; the app begins honouring it when its client reads <code>platform_settings</code>.</p>
      </div>
    </Panel>
  )
}

function Announcement({ data, canManage, onSaved }: { data: PlatformData; canManage: boolean; onSaved: () => Promise<void> }) {
  const s = useSetting(data, 'announcement', onSaved)
  const [enabled, setEnabled] = useState(s.value.enabled === true)
  const [text, setText] = useState(String(s.value.text ?? ''))
  const [tone, setTone] = useState<'info' | 'warning' | 'success'>((s.value.tone as 'info') ?? 'info')
  return (
    <Panel title="In-app announcement" description="A banner for every user" actions={<Pill tone={s.value.enabled ? 'brand' : 'neutral'}>{s.value.enabled ? 'Live' : 'Off'}</Pill>}>
      <div className="space-y-4">
        <div className="flex items-center justify-between"><span className="text-sm">Show the banner</span><Switch size="touch" checked={enabled} onCheckedChange={setEnabled} disabled={!canManage} aria-label="Announcement" /></div>
        <Field label="Text"><Input size="brand" value={text} maxLength={300} onChange={(e) => setText(e.target.value)} disabled={!canManage} /></Field>
        <SegmentedControl ariaLabel="Banner tone" fill={false} value={tone} onChange={setTone} options={[{ value: 'info', label: 'Info' }, { value: 'warning', label: 'Warning' }, { value: 'success', label: 'Good news' }]} />
        {canManage ? <Button size="touch" loading={s.busy} onClick={() => void s.save({ enabled, text, tone })}>Save</Button> : null}
      </div>
    </Panel>
  )
}

function MinVersion({ data, canManage, onSaved }: { data: PlatformData; canManage: boolean; onSaved: () => Promise<void> }) {
  const s = useSetting(data, 'min_app_version', onSaved)
  const [ios, setIos] = useState(String(s.value.ios ?? ''))
  const [android, setAndroid] = useState(String(s.value.android ?? ''))
  const [iosUrl, setIosUrl] = useState(String(s.value.ios_url ?? ''))
  const [androidUrl, setAndroidUrl] = useState(String(s.value.android_url ?? ''))
  const stepUp = useStepUp()
  const save = async () => {
    const extra: Record<string, unknown> = {}
    if (ios || android) {
      if (exceedsLatestRelease(ios.trim(), android.trim())) {
        const typed = window.prompt(`The newest release is ${APP_CLIENT_VERSION}. A higher minimum locks out every user. Type ${LOCK_OUT_CONFIRMATION} to continue.`)
        if (typed !== LOCK_OUT_CONFIRMATION) return
        extra.confirmText = typed
      }
      const proof = await stepUp('A minimum app version blocks every release below it. Confirm it’s you.')
      if (!proof) return
      Object.assign(extra, proof)
    }
    await s.save({ ios, android, ios_url: iosUrl, android_url: androidUrl }, extra)
  }
  return (
    <Panel title="Minimum app version" description="Releases below this stop working and show an update screen (the apps from this release on); older releases simply stop connecting. Leave empty to allow everything.">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="iOS"><Input size="brand" placeholder="1.1.0" value={ios} onChange={(e) => setIos(e.target.value)} disabled={!canManage} /></Field>
          <Field label="Android"><Input size="brand" placeholder="1.1.0" value={android} onChange={(e) => setAndroid(e.target.value)} disabled={!canManage} /></Field>
        </div>
        <Field label="iOS update link" hint="Opened by the Update now button (TestFlight or App Store)."><Input size="brand" placeholder="https://testflight.apple.com/join/…" value={iosUrl} onChange={(e) => setIosUrl(e.target.value)} disabled={!canManage} /></Field>
        <Field label="Android update link" hint="Play Store or the APK download."><Input size="brand" placeholder="https://…" value={androidUrl} onChange={(e) => setAndroidUrl(e.target.value)} disabled={!canManage} /></Field>
        {canManage ? <Button size="touch" loading={s.busy} onClick={() => void save()}>Save</Button> : null}
        <dl><KeyValue label="Current iOS minimum">{String(s.value.ios || 'none')}</KeyValue><KeyValue label="Current Android minimum">{String(s.value.android || 'none')}</KeyValue></dl>
      </div>
    </Panel>
  )
}
