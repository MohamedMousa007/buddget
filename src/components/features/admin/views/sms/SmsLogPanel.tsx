'use client'

import { Fragment, useCallback, useEffect, useState } from 'react'
import { Check, ChevronDown, RefreshCw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { adminNavigate } from '../../adminRouter'
import { adminFetch, errorMessage } from '../../adminClient'
import { dateTime } from '../../format'
import { LEARN, METHOD, FAILURE_LABELS, isFailedRow, rowStatus } from '../../smsDisplay'
import { useAdminAction } from '../../useAdminAction'
import { Toolbar } from '../../ui/Field'
import { Loading, Notice, Panel } from '../../ui/Panel'
import { Pill } from '../../ui/Pill'
import type { SmsTrackedRow } from '../../types'

type Queue = 'errors' | 'all'

/** The complete log of every SMS received — or just the ones that need a human (`queue="errors"`). */
export function SmsLogPanel({ queue: initial, userId, canTicket }: { queue: Queue; userId?: string; canTicket: boolean }) {
  const [queue, setQueue] = useState<Queue>(initial)
  const [sender, setSender] = useState('')
  const [appliedSender, setAppliedSender] = useState('')
  const [rows, setRows] = useState<SmsTrackedRow[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [now, setNow] = useState(0)
  const [canReveal, setCanReveal] = useState(false)
  const [revealed, setRevealed] = useState<Record<string, string | null>>({})
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const [revealing, setRevealing] = useState<string | null>(null)
  const [revealError, setRevealError] = useState<string | null>(null)

  const load = useCallback(async (append: boolean, from: string | null) => {
    setLoading(true)
    setError(null)
    try {
      const p = new URLSearchParams({ queue, limit: '50' })
      if (userId) p.set('userId', userId)
      if (appliedSender) p.set('sender', appliedSender)
      if (append && from) p.set('cursor', from)
      const res = await adminFetch<{ rows: SmsTrackedRow[]; nextCursor: string | null; canReveal?: boolean }>(`/api/admin/sms/logs?${p}`)
      setCanReveal(res.canReveal === true)
      setRows((prev) => (append ? [...prev, ...res.rows] : res.rows))
      setCursor(res.nextCursor)
      setNow(Date.now())
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [queue, userId, appliedSender])

  useEffect(() => {
    void load(false, null)
  }, [load])

  const { run, busy } = useAdminAction('/api/admin/sms/logs')
  const failed = rows.filter((r) => isFailedRow(r.status)).length

  const reveal = async (id: string) => {
    setRevealing(id)
    setRevealError(null)
    try {
      const res = await adminFetch<{ raw_body: string | null }>('/api/admin/sms/logs', { method: 'POST', json: { op: 'reveal', id, reason: reasons[id] ?? '' } })
      setRevealed((prev) => ({ ...prev, [id]: res.raw_body }))
    } catch (e) {
      setRevealError(errorMessage(e))
    } finally {
      setRevealing(null)
    }
  }

  return (
    <Panel
      flush
      title={queue === 'errors' ? 'Error queue' : 'Tracked SMS'}
      description={queue === 'errors' ? 'Failed imports and messages that never reached the app, newest first' : 'Every SMS received across all users'}
      actions={<Button variant="outline" size="touch" loading={loading} onClick={() => void load(false, null)}><RefreshCw />Refresh</Button>}
    >
      <Toolbar>
        <SegmentedControl ariaLabel="SMS queue" fill={false} value={queue} onChange={setQueue} options={[{ value: 'errors', label: 'Needs attention' }, { value: 'all', label: 'All SMS' }]} />
        <form className="min-w-[180px] flex-1" onSubmit={(e) => { e.preventDefault(); setAppliedSender(sender.trim()) }}>
          <Input aria-label="Filter by sender" placeholder="Filter by sender" value={sender} onChange={(e) => setSender(e.target.value)} className="h-10" />
        </form>
        {userId ? <Pill tone="brand">One user <button type="button" data-raw-button-ok="inline chip dismiss" aria-label="Clear user filter" onClick={() => adminNavigate('sms', { tab: 'tracked' })}><X className="size-3" /></button></Pill> : null}
        {failed > 0 ? <Pill tone="bad">{failed} failed</Pill> : null}
      </Toolbar>

      {error ? <div className="p-5"><Notice tone="negative">{error}</Notice></div> : null}
      {loading && rows.length === 0 ? <div className="p-5"><Loading rows={6} /></div> : null}
      {!loading && rows.length === 0 && !error ? <p className="px-5 py-12 text-center text-sm text-[var(--color-brand-text-muted)]">{queue === 'errors' ? 'No SMS need attention.' : 'No SMS found.'}</p> : null}

      {rows.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-xs">
            <thead>
              <tr className="border-b border-[var(--color-brand-border)] text-start text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-brand-text-muted)]">
                {['Status', 'Transaction', 'Sender', 'User', 'Method', 'Push', 'In-app', 'When', ''].map((h, i) => <th key={i} className="px-3 py-2.5 text-start">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isOpen = open === row.id
                const st = rowStatus(row, now)
                const method = row.parse_method ? METHOD[row.parse_method] : null
                const learn = row.parse_method === 'ai' && row.learn_status ? (LEARN[row.learn_status] ?? { label: row.learn_status, tone: 'neutral' as const }) : null
                const name = row.clean_title ?? row.merchant ?? row.bank_name ?? row.sender ?? '—'
                return (
                  <Fragment key={row.id}>
                    <tr onClick={() => setOpen(isOpen ? null : row.id)} className="cursor-pointer border-b border-[var(--color-brand-border)] transition-colors hover:bg-[var(--color-brand-elevated)]/60">
                      <td className="px-3 py-2.5"><Pill tone={st.tone}>{st.label}</Pill></td>
                      <td className="max-w-56 px-3 py-2.5"><span className="block truncate font-medium text-[var(--color-brand-text-primary)]">{row.amount != null && row.currency ? `${row.currency} ${row.amount.toLocaleString()} · ` : ''}{name}</span></td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-[var(--color-brand-text-secondary)]">{row.sender ?? '—'}</td>
                      <td className="max-w-44 px-3 py-2.5"><span className="block truncate text-[var(--color-brand-text-secondary)]" title={row.email ?? row.user_id}>{row.email ?? `${row.user_id.slice(0, 8)}…`}</span></td>
                      <td className="px-3 py-2.5">
                        {method ? <Pill tone={method.tone}>{method.label}</Pill> : <span className="text-[var(--color-brand-text-muted)]">—</span>}
                        {learn ? <span className="mt-1 block"><Pill tone={learn.tone}>{learn.label}</Pill></span> : null}
                      </td>
                      <td className="px-3 py-2.5">{row.pushed_at ? <Check className="size-3.5 text-[var(--color-brand-green)]" aria-label="Push delivered" /> : row.push_result ? <X className="size-3.5 text-[var(--color-brand-red)]" aria-label="Push failed" /> : <span className="text-[var(--color-brand-text-muted)]">—</span>}</td>
                      <td className="px-3 py-2.5">{row.acked_at ? <Check className="size-3.5 text-[var(--color-brand-green)]" aria-label="Rendered in app" /> : <span className="text-[var(--color-brand-text-muted)]">—</span>}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-[var(--color-brand-text-muted)]">{dateTime(row.received_at)}</td>
                      <td className="px-3 py-2.5"><ChevronDown className={`size-3.5 text-[var(--color-brand-text-muted)] transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden /></td>
                    </tr>
                    {isOpen ? (
                      <tr className="border-b border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]/40">
                        <td colSpan={9} className="space-y-3 px-4 py-4">
                          <div>
                            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-brand-text-muted)]">Raw SMS</p>
                            {row.id in revealed ? (
                              <pre className="max-h-40 select-text overflow-y-auto whitespace-pre-wrap break-all rounded-lg bg-[var(--color-brand-card)] p-3 font-mono text-[11px] leading-relaxed text-[var(--color-brand-text-secondary)]">{revealed[row.id] ?? '(empty)'}</pre>
                            ) : canReveal ? (
                              <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); void reveal(row.id) }}>
                                <Input aria-label="Reason for reading this message" placeholder="Why do you need the message text? (logged)" value={reasons[row.id] ?? ''} onChange={(e) => setReasons((prev) => ({ ...prev, [row.id]: e.target.value }))} className="h-10 min-w-[220px] flex-1" />
                                <Button type="submit" variant="outline" size="sm" loading={revealing === row.id} disabled={(reasons[row.id] ?? '').trim().length < 8}>Reveal</Button>
                              </form>
                            ) : (
                              <p className="text-[var(--color-brand-text-muted)]">Message text is hidden. It needs the financial-content permission.</p>
                            )}
                            {revealError && revealing === null ? <p className="mt-1.5 text-[var(--color-brand-red-text)]">{revealError}</p> : null}
                          </div>
                          {row.failure_code ? <p className="text-[var(--color-brand-amber)]">{row.status === 'failed' ? 'Failure' : 'Rejected'}: {FAILURE_LABELS[row.failure_code] ?? row.failure_code} <span className="font-mono">({row.failure_code})</span></p> : null}
                          <p className="text-[var(--color-brand-text-muted)]">
                            Delivery <span className="font-mono">{row.status}</span>
                            {row.pushed_at ? ` · pushed ${dateTime(row.pushed_at)}` : ' · not pushed'}
                            {row.acked_at ? ` · rendered ${dateTime(row.acked_at)}` : ' · not rendered'}
                            {row.push_result ? (row.push_result.error ? ` · push error: ${row.push_result.error}` : ` · push sent ${row.push_result.sent ?? 0}, failed ${row.push_result.failed ?? 0}`) : ''}
                          </p>
                          <p className="text-[var(--color-brand-text-muted)]">
                            {row.confidence != null ? `${Math.round(row.confidence * 100)}% confidence` : ''}{row.kind ? ` · ${row.kind}` : ''}{row.source ? ` · via ${row.source}` : ''}
                            {row.account_last4 ? ` · ••${row.account_last4}` : ''}{row.payment_instrument ? ` · ${row.payment_instrument}` : ''}{row.pattern_id ? ` · pattern ${row.pattern_id}` : ''}
                            {row.expense_id ? ' · expense linked' : ''}{row.income_id ? ' · income linked' : ''}{row.account_linked ? ' · account linked' : ''}{row.balance_reported ? (row.balance_after != null ? ` · balance ${row.balance_after}` : ' · balance reported') : ''}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <Button variant="outline" size="sm" onClick={() => adminNavigate('users', { id: row.user_id })}>Open user</Button>
                            {canTicket ? <Button variant="outline" size="sm" loading={busy === row.id} onClick={() => void run(row.id, { op: 'create_ticket', id: row.id }, { success: 'Ticket created', then: ((r: { ticketId: string }) => adminNavigate('support', { ticket: r.ticketId })) as never })}>Create ticket</Button> : null}
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {cursor ? (
        <div className="border-t border-[var(--color-brand-border)] p-4">
          <Button variant="outline" size="touch" className="w-full" loading={loading} onClick={() => void load(true, cursor)}>Load more</Button>
        </div>
      ) : null}
    </Panel>
  )
}
