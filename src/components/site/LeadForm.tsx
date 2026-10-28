'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { track } from './track'

type Kind = 'waitlist' | 'contact'
type Props = {
  kind: Kind
  locale: 'en' | 'ar'
  labels: { name?: string; email: string; message?: string; placeholder?: string; submit: string; sent: string; error: string }
  inline?: boolean
}

export function LeadForm({ kind, locale, labels, inline }: Props) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    setState('sending')
    try {
      const res = await fetch('/api/site/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind, locale,
          email: form.get('email'),
          name: form.get('name') ?? undefined,
          message: form.get('message') ?? undefined,
          company: form.get('company') ?? undefined,
        }),
      })
      if (res.ok && kind === 'waitlist') track('lead_submit')
      setState(res.ok ? 'sent' : 'error')
    } catch {
      setState('error')
    }
  }

  if (state === 'sent') return <p role="status" className="rounded-2xl bg-brand-primary-soft p-5 font-medium text-brand-primary-ink">{labels.sent}</p>

  return (
    <form onSubmit={onSubmit} className={inline ? 'flex flex-wrap gap-3' : 'grid gap-4'}>
      {kind === 'contact' ? (
        <label className="grid gap-1.5 text-[15px]">
          <span>{labels.name}</span>
          <Input size="brand" name="name" autoComplete="name" required maxLength={120} />
        </label>
      ) : null}
      <label className={inline ? 'flex-1 basis-60' : 'grid gap-1.5 text-[15px]'}>
        <span className={inline ? 'sr-only' : ''}>{labels.email}</span>
        <Input size="brand" type="email" name="email" autoComplete="email" required maxLength={254} placeholder={labels.placeholder} dir="ltr" className={inline ? 'h-14 rounded-full px-5' : ''} />
      </label>
      {kind === 'contact' ? (
        <label className="grid gap-1.5 text-[15px]">
          <span>{labels.message}</span>
          <textarea name="message" required rows={5} maxLength={4000} className="rounded-xl border border-brand-border bg-brand-elevated p-3.5 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring/55" />
        </label>
      ) : null}
      <input type="text" name="company" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      <Button type="submit" size="cta" loading={state === 'sending'} className={inline ? 'h-14 rounded-full px-8 text-base font-semibold' : 'justify-self-start rounded-full px-8 text-base font-semibold'}>
        {labels.submit}
      </Button>
      {state === 'error' ? <p role="alert" className="basis-full text-sm text-brand-red">{labels.error}</p> : null}
    </form>
  )
}
