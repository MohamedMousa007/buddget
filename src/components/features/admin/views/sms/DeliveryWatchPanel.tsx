'use client'

import { AlertTriangle } from 'lucide-react'
import { adminNavigate } from '../../adminRouter'
import { useAdminQuery } from '../../adminClient'
import { ago } from '../../format'
import { Notice, Panel } from '../../ui/Panel'
import { Pill } from '../../ui/Pill'
import type { CanaryState, FindingKind } from '@/lib/sms/queueWatch'

interface Watch {
  findings: Array<{ kind: FindingKind; userId: string; deviceId: string; platform: string; name: string | null; pending: number; evicted: number; lastResult: string | null; since: string | null; email: string | null }>
  canary: { state: CanaryState; at: string | null; checks: Array<{ name: string; ok: boolean; detail: string }> }
}

const KIND: Record<FindingKind, { label: string; tone: 'bad' | 'warn' | 'neutral' }> = {
  evicted: { label: 'Lost messages', tone: 'bad' },
  stuck: { label: 'Stuck queue', tone: 'warn' },
  silent: { label: 'Gone quiet', tone: 'neutral' },
}

/** What needs a human now: phones holding undelivered SMS, phones that dropped some, and whether the delivery path itself is healthy. */
export function DeliveryWatchPanel() {
  const { data, error } = useAdminQuery<Watch>('/api/admin/sms/queue-health')
  if (error && !data) return <Notice tone="negative">{error}</Notice>
  if (!data) return null
  const { canary, findings } = data
  const failedChecks = canary.checks.filter((c) => !c.ok)

  return (
    <div className="space-y-4">
      {canary.state !== 'ok' ? (
        <Notice tone={canary.state === 'failing' ? 'negative' : 'warning'}>
          <span className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              {canary.state === 'failing' ? <><strong>The SMS delivery check is failing.</strong> Phones may not be able to deliver messages. {failedChecks.map((c) => `${c.name}: ${c.detail}`).join(' · ')}</> : null}
              {canary.state === 'stale' ? <><strong>The daily SMS delivery check has not reported</strong> since {canary.at ? ago(canary.at) : 'ever'}.</> : null}
              {canary.state === 'unknown' ? <><strong>The daily SMS delivery check has not run yet.</strong></> : null}
            </span>
          </span>
        </Notice>
      ) : null}
      <Panel title="Delivery watch" description={`Phones holding undelivered messages, phones that dropped some, and phones gone quiet. Delivery check: ${canary.state}${canary.at ? `, ${ago(canary.at)}` : ''}.`} flush>
        {findings.length === 0 ? (
          <p className="px-5 py-6 text-center text-sm text-[var(--color-brand-text-muted)]">Every phone is delivering.</p>
        ) : (
          <ul className="divide-y divide-[var(--color-brand-border)]">
            {findings.map((f) => (
              <li key={`${f.deviceId}-${f.kind}`}>
                <button type="button" onClick={() => adminNavigate('sms', { tab: 'tracked', userId: f.userId })} className="flex min-h-11 w-full flex-wrap items-center justify-between gap-2 px-5 py-3 text-start text-sm hover:bg-[var(--color-brand-surface)]">
                  <span className="min-w-0">
                    <span className="block truncate text-[var(--color-brand-text-primary)]">{f.email ?? f.userId}</span>
                    <span className="block text-xs text-[var(--color-brand-text-muted)]">
                      {f.name ?? f.platform} · {f.kind === 'silent' ? `last seen ${ago(f.since)}` : f.since ? `oldest ${ago(f.since)}` : 'age unknown'}{f.lastResult ? ` · last forward: ${f.lastResult}` : ''}
                    </span>
                  </span>
                  <span className="flex flex-wrap gap-1.5">
                    <Pill tone={KIND[f.kind].tone}>{KIND[f.kind].label}</Pill>
                    {f.pending > 0 ? <Pill tone="warn">{f.pending} waiting</Pill> : null}
                    {f.evicted > 0 ? <Pill tone="bad">{f.evicted} dropped</Pill> : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}
