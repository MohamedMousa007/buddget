'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { adminPost, errorMessage } from '../../adminClient'
import { useConfirm } from '@/components/ui/dialog/DialogProvider'
import { Loading, Notice, Panel } from '../../ui/Panel'
import type { EligibleTemplate, SmsPromotionConfig } from '../../types'

const DEFAULTS: Omit<SmsPromotionConfig, 'id' | 'updated_at'> = {
  min_match_count: 50, min_unique_users: 3, min_age_days: 7, max_failure_rate: 0.05, min_avg_confidence: 0.9,
  // Retirement side of the same funnel — see migration 0097.
  min_matches_before_retire: 5, quarantine_exonerate_after: 3, signals_before_adjudication: 2, max_user_signals_per_day: 10,
}

type NumericKey = Exclude<keyof SmsPromotionConfig, 'id' | 'updated_at'>

const PROMOTION: Array<[NumericKey, string, string, number]> = [
  ['min_match_count', 'Min matches', 'Times this template matched an SMS', 5],
  ['min_unique_users', 'Min distinct users', 'Different users who triggered this template', 1],
  ['min_age_days', 'Min age (days)', 'How long since the template was first learned', 1],
  ['max_failure_rate', 'Max failure rate', 'Fraction of matches that may fail before retire (0.05 = 5%)', 0.005],
  ['min_avg_confidence', 'Min avg AI confidence', 'Minimum AI confidence when the template was created', 0.01],
]
const RETIREMENT: Array<[NumericKey, string, string, number]> = [
  ['min_matches_before_retire', 'Min matches before retire', 'Matches served before a soft-signal rate can retire a template', 1],
  ['quarantine_exonerate_after', 'Shadow agreements to exonerate', 'Consecutive AI agreements that clear a quarantined template', 1],
  ['signals_before_adjudication', 'Signals before adjudication', 'User signals on one template before an AI adjudication is spent', 1],
  ['max_user_signals_per_day', 'Max user signals / day', 'Per-user cap so a bulk delete cannot mass-quarantine', 1],
]

export function PromotionPanel({ canManage }: { canManage: boolean }) {
  const confirm = useConfirm()
  const [draft, setDraft] = useState<SmsPromotionConfig | null>(null)
  const [eligible, setEligible] = useState<EligibleTemplate[]>([])
  const [message, setMessage] = useState<{ tone: 'positive' | 'negative' | 'info'; text: string } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const call = useCallback(async (key: string, body: Record<string, unknown>) => {
    setBusy(key)
    try {
      return await adminPost<Record<string, unknown>>('/api/admin/sms/promotion', body)
    } catch (e) {
      setMessage({ tone: 'negative', text: errorMessage(e) })
      return null
    } finally {
      setBusy(null)
    }
  }, [])

  useEffect(() => {
    void call('get', { op: 'get' }).then((r) => r && setDraft(r.config as SmsPromotionConfig))
  }, [call])

  const set = (key: NumericKey, value: number) => setDraft((d) => (d ? { ...d, [key]: value } : d))

  const save = async () => {
    if (!draft) return
    const res = await call('save', { op: 'save', config: draft })
    if (res) {
      setDraft(res.config as SmsPromotionConfig)
      setMessage({ tone: 'positive', text: 'Promotion criteria saved.' })
      const elig = await adminPost<{ eligible: EligibleTemplate[] }>('/api/admin/sms/templates', { op: 'check_eligibility' }).catch(() => null)
      if (elig) setEligible(elig.eligible)
    }
  }

  const reset = async () => {
    if (!(await confirm({ title: 'Reset to factory defaults?', body: 'Replaces every threshold on this page.', destructive: true, confirmLabel: 'Reset' }))) return
    const res = await call('reset', { op: 'save', config: DEFAULTS })
    if (res) { setDraft(res.config as SmsPromotionConfig); setMessage({ tone: 'positive', text: 'Defaults restored.' }) }
  }

  const run = async () => {
    const res = await call('run', { op: 'run_auto_promote' })
    if (res) {
      const promoted = Number(res.promoted ?? 0), total = Number(res.eligible ?? 0)
      setMessage({ tone: promoted ? 'positive' : 'info', text: promoted ? `Promoted ${promoted} of ${total} eligible templates.` : total ? `${total} eligible but already promoted.` : 'No templates currently meet the criteria.' })
    }
  }

  const field = ([key, label, hint, step]: [NumericKey, string, string, number]) => (
    <div key={key} className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0"><p className="text-sm font-medium text-[var(--color-brand-text-primary)]">{label}</p><p className="text-xs text-[var(--color-brand-text-muted)]">{hint}</p></div>
      {/* Exact thresholds a human reasons about ("3 distinct users", "5% failures") — a number box, not a slider. */}
      <Input type="number" step={step} min={0} aria-label={label} value={draft ? draft[key] : 0} disabled={!draft || !canManage} onChange={(e) => set(key, parseFloat(e.target.value || '0'))} className="h-10 w-24 shrink-0 text-end font-mono-numbers" />
    </div>
  )

  if (!draft) return <Panel title="Auto-promotion"><Loading rows={5} /></Panel>

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Panel title="Promotion criteria" description="A template meeting all of these is promoted to the global Curated DB automatically.">
        <div className="divide-y divide-[var(--color-brand-border)]">{PROMOTION.map(field)}</div>
      </Panel>
      <Panel title="Retirement & health" description="The other half of the funnel: how templates are quarantined and retired.">
        <div className="divide-y divide-[var(--color-brand-border)]">{RETIREMENT.map(field)}</div>
      </Panel>
      <div className="space-y-4 xl:col-span-2">
        {eligible.length > 0 ? <Notice tone="warning">{eligible.length} template{eligible.length > 1 ? 's' : ''} currently eligible · senders: {[...new Set(eligible.map((t) => t.sender))].join(', ')}</Notice> : null}
        {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
        {canManage ? (
          <div className="flex flex-wrap gap-3">
            <Button size="touch" loading={busy === 'save'} onClick={() => void save()}>Save criteria</Button>
            <Button variant="outline" size="touch" loading={busy === 'run'} onClick={() => void run()}>Run check now</Button>
            <Button variant="ghost" size="touch" loading={busy === 'reset'} onClick={() => void reset()}>Reset to defaults</Button>
          </div>
        ) : <Notice>Your role can view the criteria but not change them.</Notice>}
      </div>
    </div>
  )
}
