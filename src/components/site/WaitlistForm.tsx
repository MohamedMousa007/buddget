'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { OptionChip } from '@/components/ui/OptionChip'
import type { SiteLocale } from '@/lib/site/config'
import { siteContent } from '@/lib/site/routes'
import { UTM_KEYS, WAITLIST_COUNTRIES, firstWord, waitlistShareUrl } from '@/lib/site/waitlist'
import { MemberPass } from './WaitlistPass'
import { track } from './track'

type Platform = '' | 'ios' | 'android'
type Joined = { shareCode?: string; referrals?: number; name: string | null }

const FIELD = 'h-12 w-full rounded-xl border border-brand-border bg-brand-elevated px-3.5 text-base text-brand-text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring'
const camel = (k: string) => k.replace(/_(\w)/g, (_, c: string) => c.toUpperCase())

/** Waitlist sign-up: email and the lead questions, then the person's share link. Posts to /api/site/waitlist. */
export function WaitlistForm({ locale }: { locale: SiteLocale }) {
  const w = siteContent[locale].waitlist
  const f = w.form
  const [platform, setPlatform] = useState<Platform>('')
  const [attribution, setAttribution] = useState<Record<string, string>>({})
  const [state, setState] = useState<'idle' | 'sending' | 'error' | 'disposable'>('idle')
  const [joined, setJoined] = useState<Joined | null>(null)

  useEffect(() => {
    const ua = navigator.userAgent
    setPlatform(/iPhone|iPad|iPod/i.test(ua) ? 'ios' : /Android/i.test(ua) ? 'android' : '')
    const q = new URLSearchParams(window.location.search)
    const a: Record<string, string> = {}
    for (const k of [...UTM_KEYS, 'ref'] as const) {
      const v = q.get(k)?.trim()
      if (v) a[k === 'ref' ? 'ref' : camel(k)] = v.slice(0, 100)
    }
    setAttribution(a)
  }, [])

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!platform) return
    const form = new FormData(e.currentTarget)
    const pick = (k: string) => (form.get(k) as string | null) || undefined
    setState('sending')
    try {
      const res = await fetch('/api/site/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...attribution, locale, platform,
          email: pick('email'), name: pick('name'), country: pick('country'),
          trackingNow: pick('trackingNow'), wantMost: pick('wantMost'), heardFrom: pick('heardFrom'), company: pick('company'),
        }),
      })
      const body = (await res.json().catch(() => ({}))) as Joined & { error?: string }
      if (!res.ok) { setState(body.error === 'disposable' ? 'disposable' : 'error'); return }
      track('lead_submit')
      setJoined({ ...body, name: firstWord(pick('name')) })
      setState('idle')
    } catch {
      setState('error')
    }
  }

  if (joined) return <WaitlistShare locale={locale} joined={joined} />

  const select = (name: string, label: string, options: Record<string, string>, required = false) => (
    <label className="grid gap-1.5 text-[15px] font-medium">
      <span>{label}{required ? null : <span className="font-normal text-brand-text-secondary"> ({f.optional})</span>}</span>
      <select name={name} required={required} defaultValue="" className={FIELD}>
        <option value="" disabled={required}>{f.choose}</option>
        {Object.entries(options).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  )

  return (
    <form onSubmit={onSubmit} className="grid gap-4" aria-label={f.title}>
      <label className="grid gap-1.5 text-[15px] font-medium">
        <span>{f.email}</span>
        <Input size="brand" type="email" name="email" autoComplete="email" required maxLength={254} placeholder={f.emailPlaceholder} dir="ltr" />
      </label>
      <label className="grid gap-1.5 text-[15px] font-medium">
        <span>{f.name} <span className="font-normal text-brand-text-secondary">({f.optional})</span></span>
        <Input size="brand" name="name" autoComplete="given-name" maxLength={120} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        {select('country', f.country, Object.fromEntries(WAITLIST_COUNTRIES.map((c) => [c, f.countries[c]])), true)}
        <div role="group" aria-labelledby="wl-platform" className="grid gap-1.5 text-[15px] font-medium">
          <span id="wl-platform">{f.platform}</span>
          <div className="flex gap-2">
            {(['ios', 'android'] as const).map((v) => (
              <OptionChip key={v} type="button" size="segment" selected={platform === v} onClick={() => setPlatform(v)}>{v === 'ios' ? f.ios : f.android}</OptionChip>
            ))}
          </div>
        </div>
      </div>
      {select('trackingNow', f.trackingNow, f.trackingOptions)}
      {select('wantMost', f.wantMost, f.wantOptions)}
      {select('heardFrom', f.heardFrom, f.heardOptions)}
      <input type="text" name="company" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      <Button type="submit" size="cta" loading={state === 'sending'} loadingText={f.busy} disabled={!platform} className="rounded-full px-8 text-base font-semibold">
        {f.submit}
      </Button>
      <p className="text-sm text-brand-text-secondary">{f.fine}</p>
      {state === 'error' || state === 'disposable' ? <p role="alert" className="text-sm text-brand-red">{state === 'disposable' ? f.disposable : f.error}</p> : null}
    </form>
  )
}

function WaitlistShare({ locale, joined }: { locale: SiteLocale; joined: Joined }) {
  const d = siteContent[locale].waitlist.done
  const [copied, setCopied] = useState(false)
  const url = joined.shareCode ? waitlistShareUrl(window.location.origin, locale, joined.shareCode) : null

  async function share() {
    if (!url) return
    if (navigator.share) {
      try { await navigator.share({ text: d.shareText, url }) } catch { /* the person closed the share sheet */ }
      return
    }
    await navigator.clipboard.writeText(url)
    setCopied(true)
  }

  return (
    <div role="status" className="grid gap-5">
      <div>
        <p className="font-heading text-2xl font-bold">{d.h}</p>
        <p className="mt-1 text-brand-text-secondary">{d.p}</p>
      </div>
      {url && joined.shareCode ? (
        <>
          <div>
            <p className="font-semibold">{d.shareH}</p>
            <p className="mt-1 text-sm text-brand-text-secondary">{d.shareP}</p>
          </div>
          <MemberPass locale={locale} code={joined.shareCode} name={joined.name} />
          <Input size="brand" readOnly value={url} dir="ltr" aria-label={d.shareH} onFocus={(e) => e.currentTarget.select()} />
          <div className="flex flex-wrap gap-3">
            <Button size="cta" className="rounded-full px-6" onClick={() => void share()}>{d.share}</Button>
            <Button size="cta" variant="outline" className="rounded-full px-6" onClick={() => void navigator.clipboard.writeText(url).then(() => setCopied(true))}>{copied ? d.copied : d.copy}</Button>
          </div>
        </>
      ) : null}
    </div>
  )
}
