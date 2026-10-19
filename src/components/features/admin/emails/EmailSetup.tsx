'use client'

import { CheckCircle2, Circle } from 'lucide-react'
import { useAdminQuery } from '../adminClient'
import { ago } from '../format'
import { KeyValue, Loading, Notice, Panel } from '../ui/Panel'
import { Pill } from '../ui/Pill'

interface Setup {
  hookUrl: string
  webhookUrl: string
  checks: Record<'resendKey' | 'emailFrom' | 'hookSecret' | 'webhookSecret' | 'translator', boolean>
  hook: { last: { created_at: string; template_key: string; status: string } | null; sentLast24h: number; failedLast24h: number }
}

const CHECKS: Array<{ key: keyof Setup['checks']; label: string; hint: string }> = [
  { key: 'resendKey', label: 'RESEND_API_KEY', hint: 'Sends every email.' },
  { key: 'emailFrom', label: 'EMAIL_FROM', hint: 'On a domain verified in Resend.' },
  { key: 'hookSecret', label: 'SEND_EMAIL_HOOK_SECRET', hint: 'The secret Supabase shows when you create the hook.' },
  { key: 'webhookSecret', label: 'RESEND_WEBHOOK_SECRET', hint: 'Lets the send log show delivered, bounced and complained.' },
  { key: 'translator', label: 'GEMINI_API_KEY', hint: 'Buddgy writes the other language automatically.' },
]

export function EmailSetup() {
  const { data, error, loading } = useAdminQuery<Setup>('/api/admin/emails/setup')
  if (error && !data) return <Notice tone="negative">{error}</Notice>
  if (!data && loading) return <Loading rows={5} />
  if (!data) return null
  const live = data.hook.sentLast24h > 0

  return (
    <div className="space-y-4">
      <Panel title="Supabase email hook" description="Once this is on, every sign-up, code, magic link, reset and email change comes from the templates here.">
        <dl className="divide-y divide-[var(--color-brand-border)]">
          <KeyValue label="Status">{live ? <Pill tone={data.hook.failedLast24h ? 'warn' : 'good'}>Live</Pill> : <Pill>Waiting for the hook</Pill>}</KeyValue>
          <KeyValue label="Sent through the hook (24h)">{data.hook.sentLast24h}{data.hook.failedLast24h ? ` · ${data.hook.failedLast24h} failed` : ''}</KeyValue>
          <KeyValue label="Last hook email">{data.hook.last ? `${data.hook.last.template_key} · ${data.hook.last.status} · ${ago(data.hook.last.created_at)}` : 'None yet'}</KeyValue>
          <KeyValue label="Hook URL" mono>{data.hookUrl}</KeyValue>
          <KeyValue label="Resend webhook URL" mono>{data.webhookUrl}</KeyValue>
        </dl>
      </Panel>
      <Panel title="Ready checklist">
        <ul className="space-y-3">
          {CHECKS.map((c) => (
            <li key={c.key} className="flex items-start gap-3">
              {data.checks[c.key] ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[var(--color-brand-green)]" aria-label="Set" /> : <Circle className="mt-0.5 size-5 shrink-0 text-[var(--color-brand-text-muted)]" aria-label="Not set" />}
              <div className="min-w-0">
                <p className="font-mono text-sm text-[var(--color-brand-text-primary)]">{c.label}</p>
                <p className="text-xs text-[var(--color-brand-text-muted)]">{c.hint}</p>
              </div>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  )
}
