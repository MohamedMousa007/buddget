'use client'

import { useState } from 'react'
import { ClipboardCopy, Download, CalendarClock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useActionToast } from '@/components/ui/ActionToast'
import { adminFetch, errorMessage, useAdminQuery } from '../../adminClient'
import { useAdminAction } from '../../useAdminAction'
import { Field } from '../../ui/Field'
import { AdminSheet } from '../../ui/AdminSheet'
import { StatTile, KpiGrid } from '../../ui/Kpi'
import { Loading, Notice, Panel } from '../../ui/Panel'
import { Pill, StatusPill } from '../../ui/Pill'
import { useStepUp } from '../../ui/StepUp'
import { DataTable } from '../../ui/DataTable'
import { bannerText, packToCsv, type Countdown } from '@/lib/admin/patternReview'
import { PATTERN_REVIEW_PROMPT } from '@/lib/admin/patternReviewPrompt'

export const REVIEW_PATH = '/api/admin/sms/pattern-review'

interface Review { id: string; period_start: string; period_end: string; status: string; notes: string | null; reviewed_at: string | null; created_at: string }
export interface ReviewOverview { countdown: Countdown; reviews: Review[]; tableReady: boolean; canManage: boolean }

function save(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  a.click()
  URL.revokeObjectURL(url)
}

/** Copy review prompt + Download review pack: the two actions the purge banner and the page share. */
export function ReviewActions() {
  const toast = useActionToast()
  const [busy, setBusy] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(PATTERN_REVIEW_PROMPT)
      toast('Review prompt copied')
    } catch {
      toast('Could not copy. Open docs/sms-pattern-review-prompt.md instead.')
    }
  }

  const download = async (format: 'json' | 'csv') => {
    setBusy(true)
    try {
      const res = await adminFetch<{ available: boolean; rows: Array<Record<string, unknown>> }>(`${REVIEW_PATH}?view=pack`)
      if (!res.available) { toast('Review pack not available yet'); return }
      const stamp = new Date().toISOString().slice(0, 10)
      if (format === 'csv') save(`sms-review-pack-${stamp}.csv`, packToCsv(res.rows), 'text/csv')
      else save(`sms-review-pack-${stamp}.json`, JSON.stringify(res.rows, null, 2), 'application/json')
    } catch (e) {
      toast(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button variant="outline" size="touch" onClick={() => void copy()}><ClipboardCopy />Copy review prompt</Button>
      <Button variant="outline" size="touch" disabled={busy} onClick={() => void download('json')}><Download />Download review pack</Button>
      <Button variant="ghost" size="touch" disabled={busy} onClick={() => void download('csv')}>CSV</Button>
    </>
  )
}

export function PurgeBanner({ overview, onOpen }: { overview: ReviewOverview; onOpen?: () => void }) {
  const c = overview.countdown
  if (c.state !== 'ok' || !c.due) return null
  return (
    <Notice tone="warning">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <strong>{bannerText(c.daysLeft)}</strong>
        <div className="flex flex-wrap items-center gap-2">
          {onOpen ? <Button size="touch" onClick={onOpen}>Open review</Button> : <ReviewActions />}
        </div>
      </div>
    </Notice>
  )
}

export function PatternReviewPanel({ canManage }: { canManage: boolean }) {
  const q = useAdminQuery<ReviewOverview>(REVIEW_PATH)
  const stepUp = useStepUp()
  const { run, busy } = useAdminAction(REVIEW_PATH, q.refresh)
  const [mode, setMode] = useState<'reviewed' | 'skipped' | null>(null)
  const [text, setText] = useState('')

  if (q.error && !q.data) return <Notice tone="negative">{q.error}</Notice>
  if (!q.data) return <Loading rows={5} />
  const { countdown: c, reviews, tableReady } = q.data

  const submit = async () => {
    if (!mode) return
    const skip = mode === 'skipped'
    const proof = await stepUp(skip ? 'Skipping releases the purge hold. Confirm it’s you.' : 'Marking the review done releases the purge hold. Confirm it’s you.')
    if (!proof) return
    const ok = await run('review', { op: skip ? 'skip' : 'mark_reviewed', [skip ? 'reason' : 'notes']: text, ...proof }, { success: skip ? 'Review skipped' : 'Review marked as done' })
    if (ok) { setMode(null); setText('') }
  }

  return (
    <div className="space-y-6">
      <PurgeBanner overview={q.data} />
      <KpiGrid cols={3}>
        {c.state === 'off' ? <StatTile label="Next purge" value="Retention is off" sub="Raw SMS text is not being purged" /> : null}
        {c.state === 'empty' ? <StatTile label="Next purge" value="Nothing waiting" sub="No unreviewed raw SMS text" /> : null}
        {c.state === 'ok' ? <StatTile label="Next purge in" value={`${c.daysLeft} ${c.daysLeft === 1 ? 'day' : 'days'}`} tone={c.due ? 'negative' : 'default'} sub={`${new Date(c.purgeAt).toLocaleDateString()} · ${c.keepDays}-day window`} /> : null}
      </KpiGrid>

      <Panel title="Review pack" description="Masked skeletons with bank, sender, parse tier, outcome, failure code and counts. Other users’ raw text is never included." actions={<ReviewActions />}>
        <p className="text-sm text-[var(--color-brand-text-secondary)]">
          Copy the prompt, paste it into a Claude session with the Supabase connector (read-only), and give it the downloaded pack. It reports unlearned patterns, links, failures, proposed curated patterns and masking leaks.
        </p>
      </Panel>

      <Panel
        title="Review log"
        description="Marking a review done (or skipping it with a reason) releases the purge hold. The hold is capped at 60 days."
        flush
        actions={canManage && tableReady ? (
          <>
            <Button size="touch" onClick={() => { setText(''); setMode('reviewed') }}><CalendarClock />Mark reviewed</Button>
            <Button size="touch" variant="outline" onClick={() => { setText(''); setMode('skipped') }}>Skip</Button>
          </>
        ) : null}
      >
        {!tableReady ? (
          <div className="p-5"><Notice tone="info">The review log is not installed yet. It arrives with migration 0211.</Notice></div>
        ) : (
          <DataTable
            rows={reviews}
            rowKey={(r) => r.id}
            empty={<p className="p-5 text-sm text-[var(--color-brand-text-muted)]">No reviews recorded yet.</p>}
            columns={[
              { key: 'period', header: 'Period', cell: (r) => `${r.period_start} to ${r.period_end}` },
              { key: 'status', header: 'Status', cell: (r) => <StatusPill status={r.status} /> },
              { key: 'notes', header: 'Notes', wide: true, cell: (r) => r.notes ?? <Pill>—</Pill> },
              { key: 'at', header: 'Recorded', cell: (r) => new Date(r.reviewed_at ?? r.created_at).toLocaleDateString() },
            ]}
          />
        )}
      </Panel>

      <AdminSheet open={mode !== null} title={mode === 'skipped' ? 'Skip this review' : 'Mark reviewed'} onClose={() => setMode(null)}>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void submit() }}>
          <Field label={mode === 'skipped' ? 'Reason (required)' : 'Notes'} hint={mode === 'skipped' ? undefined : 'Where the report lives, and what you will act on.'}>
            <Textarea rows={4} value={text} maxLength={4000} onChange={(e) => setText(e.target.value)} />
          </Field>
          <Button type="submit" size="cta-block" disabled={busy === 'review' || (mode === 'skipped' && !text.trim())}>
            {mode === 'skipped' ? 'Skip review' : 'Mark reviewed'}
          </Button>
        </form>
      </AdminSheet>
    </div>
  )
}
