'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Props = {
  locale: 'en' | 'ar'
  labels: { name: string; email: string; message: string; submit: string; sent: string; error: string }
}

/** Contact form on the contact page. Posts to /api/site/lead; the waitlist has its own form (WaitlistForm). */
export function LeadForm({ locale, labels }: Props) {
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
          kind: 'contact', locale,
          email: form.get('email'),
          name: form.get('name') ?? undefined,
          message: form.get('message') ?? undefined,
          company: form.get('company') ?? undefined,
        }),
      })
      setState(res.ok ? 'sent' : 'error')
    } catch {
      setState('error')
    }
  }

  if (state === 'sent') return <p role="status" className="rounded-2xl bg-brand-primary-soft p-5 font-medium text-brand-primary-ink">{labels.sent}</p>

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <label className="grid gap-1.5 text-[15px]">
        <span>{labels.name}</span>
        <Input size="brand" name="name" autoComplete="name" required maxLength={120} />
      </label>
      <label className="grid gap-1.5 text-[15px]">
        <span>{labels.email}</span>
        <Input size="brand" type="email" name="email" autoComplete="email" required maxLength={254} dir="ltr" />
      </label>
      <label className="grid gap-1.5 text-[15px]">
        <span>{labels.message}</span>
        <textarea name="message" required rows={5} maxLength={4000} className="rounded-xl border border-brand-border bg-brand-elevated p-3.5 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring" />
      </label>
      <input type="text" name="company" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      <Button type="submit" size="cta" loading={state === 'sending'} className="justify-self-start rounded-full px-8 text-base font-semibold">
        {labels.submit}
      </Button>
      {state === 'error' ? <p role="alert" className="text-sm text-brand-red">{labels.error}</p> : null}
    </form>
  )
}
