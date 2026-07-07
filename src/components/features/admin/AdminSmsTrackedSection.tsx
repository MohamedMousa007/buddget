'use client'

import { Fragment, useEffect, useState } from 'react'
import { RefreshCw, ChevronDown, CheckCircle2, Check, X, AlertTriangle } from 'lucide-react'
import type { AdminPanelModel } from '@/hooks/useAdminPanel'
import type { SmsTrackedRow } from '@/types/admin'

interface Props {
  admin: AdminPanelModel
}

const UNDELIVERED_MS = 2 * 60 * 1000

const FAILURE_LABELS: Record<string, string> = {
  gemini_error: 'AI error',
  not_transaction: 'Not a transaction',
  null_amount: 'No amount',
  low_confidence: 'Low confidence',
  duplicate: 'Duplicate',
  log_insert_failed: 'Save failed',
  insert_failed: 'Save failed',
  parse_exception: 'Parse crash',
  processing: 'Processing',
  timed_out: 'Timed out',
  rate_limited: 'Rate limited',
  not_configured: 'AI not configured',
}

const METHOD_CHIPS: Record<string, { label: string; cls: string }> = {
  curated:  { label: 'Curated',  cls: 'border-green-500/20 text-green-400 bg-green-500/10' },
  template: { label: 'Template', cls: 'border-blue-500/20 text-blue-400 bg-blue-500/10' },
  // legacy values for rows recorded before simplification
  promoted: { label: 'Template', cls: 'border-blue-500/20 text-blue-400 bg-blue-500/10' },
  static:   { label: 'Template', cls: 'border-blue-500/20 text-blue-400 bg-blue-500/10' },
  ai:       { label: 'AI',       cls: 'border-amber-500/20 text-amber-400 bg-amber-500/10' },
}

/** AI template-learning outcome chip (shown under the AI method chip). */
const GREEN = 'border-green-500/20 text-green-400 bg-green-500/10'
const AMBER = 'border-amber-500/20 text-amber-400 bg-amber-500/10'
const RED = 'border-red-500/20 text-[var(--color-brand-red)] bg-red-500/10'
const BLUE = 'border-blue-500/20 text-blue-400 bg-blue-500/10'
const LEARN_CHIPS: Record<string, { label: string; cls: string }> = {
  learned: { label: 'learned', cls: GREEN },
  duplicate: { label: 'dup', cls: GREEN },
  pending: { label: 'pending', cls: BLUE },
  cap_reached: { label: 'cap', cls: AMBER },
  skipped_low_conf: { label: 'low-conf', cls: AMBER },
  skipped_no_key: { label: 'no-key', cls: AMBER },
  skipped_not_tx: { label: 'not-tx', cls: AMBER },
  gemini_error: { label: 'ai-err', cls: RED },
  no_json: { label: 'no-json', cls: RED },
  no_regex_or_amount: { label: 'bad-rule', cls: RED },
  regex_invalid: { label: 'bad-regex', cls: RED },
  regex_no_match: { label: 'no-match', cls: RED },
  insert_failed: { label: 'ins-fail', cls: RED },
  exception: { label: 'exc', cls: RED },
}

/**
 * Row status chip. "Confirmed" (green) is the only true success: a push WAS
 * delivered AND the app acked the render. "In-app only" (amber) means the app
 * got it but no push was delivered. A logged/notified row still waiting past
 * 2 min is flagged "Not confirmed".
 */
function statusChip(row: SmsTrackedRow): { label: string; cls: string; ok?: boolean } {
  const undelivered =
    (row.status === 'logged' || row.status === 'notified') &&
    Date.now() - new Date(row.received_at).getTime() > UNDELIVERED_MS

  if (undelivered) {
    return { label: 'Not confirmed', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' }
  }
  // Defensive: a parsed row with neither expense nor income linked never produced
  // a transaction — surface it as a failure regardless of how far status advanced.
  if (row.parsed_ok && !row.expense_id && !row.income_id &&
      row.status !== 'add_failed' && row.status !== 'rejected' && row.status !== 'failed' && row.status !== 'paired') {
    return { label: 'No transaction', cls: 'bg-red-500/10 text-[var(--color-brand-red)] border-red-500/20' }
  }
  switch (row.status) {
    case 'confirmed': return { label: 'Confirmed',  cls: 'bg-green-500/10 text-green-400 border-green-500/20', ok: true }
    case 'tapped':    return { label: 'Tapped · manual', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' }
    case 'rendered':  return { label: 'In-app only', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' }
    case 'paired':    return { label: 'Paired',     cls: 'bg-blue-500/10 text-blue-400 border-blue-500/20' }
    case 'notified':  return { label: 'Pushed',     cls: 'bg-blue-500/10 text-blue-400 border-blue-500/20' }
    case 'logged':    return { label: 'Logged',     cls: 'bg-blue-500/10 text-blue-400 border-blue-500/20' }
    case 'processing':return { label: 'Processing', cls: 'bg-blue-500/10 text-blue-400 border-blue-500/20' }
    case 'add_failed':return { label: 'Add failed', cls: 'bg-red-500/10 text-[var(--color-brand-red)] border-red-500/20' }
    case 'rejected':  return { label: FAILURE_LABELS[row.failure_code ?? ''] ?? 'Rejected', cls: 'bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-muted)] border-[var(--color-brand-border)]' }
    case 'failed':    return { label: FAILURE_LABELS[row.failure_code ?? ''] ?? 'Failed', cls: 'bg-red-500/10 text-[var(--color-brand-red)] border-red-500/20' }
    default:          return { label: row.status, cls: 'bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-muted)] border-[var(--color-brand-border)]' }
  }
}

/** Push delivery axis — independent of in-app render. */
function pushCell(row: SmsTrackedRow) {
  if (row.pushed_at) {
    return <Check className="h-3.5 w-3.5 text-green-400 mx-auto" aria-label="Push delivered" />
  }
  const reason = row.push_result?.error ?? (row.push_result ? `sent ${row.push_result.sent ?? 0}` : null)
  if (reason) {
    return (
      <span title={reason} className="inline-flex justify-center w-full">
        <X className="h-3.5 w-3.5 text-[var(--color-brand-red)]" aria-label={`Push failed: ${reason}`} />
      </span>
    )
  }
  return <span className="text-[var(--color-brand-text-muted)]">—</span>
}

/** In-app render axis — set when the app acked the row rendered. */
function inAppCell(row: SmsTrackedRow) {
  return row.acked_at
    ? <Check className="h-3.5 w-3.5 text-green-400 mx-auto" aria-label="Rendered in app" />
    : <span className="text-[var(--color-brand-text-muted)]">—</span>
}

type SmsFilter = 'all' | 'attention' | 'failed'

/** Auto-add failures the tech team must see. */
function isFailedRow(status: string): boolean {
  return status === 'failed' || status === 'add_failed'
}
/** Needed human intervention (failed or manually rescued). */
function needsAttention(status: string): boolean {
  return isFailedRow(status) || status === 'tapped'
}

export function AdminSmsTrackedSection({ admin }: Props) {
  const { smsTracked, smsTrackedLoading, smsTrackedCursor, loadSmsTracked, pushConfigured, checkPushHealth } = admin
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<SmsFilter>('all')

  useEffect(() => {
    void loadSmsTracked(false)
    void checkPushHealth()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pushDown = pushConfigured === false

  // Counts over the loaded window — failures float to the top (newest-first).
  const failedCount = smsTracked.filter((r) => isFailedRow(r.status)).length
  const tappedCount = smsTracked.filter((r) => r.status === 'tapped').length
  const visibleRows = smsTracked.filter((r) =>
    filter === 'all' ? true : filter === 'failed' ? isFailedRow(r.status) : needsAttention(r.status),
  )

  return (
    <section className="glass-card rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-[var(--color-brand-text-primary)]">
              SMS Logs
            </h2>
            {failedCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-[var(--color-brand-red)]">
                <AlertTriangle className="h-2.5 w-2.5" />
                {failedCount} failed
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--color-brand-text-muted)] mt-0.5">
            Every received SMS across all users. <span className="text-green-400">Confirmed</span> = push delivered AND rendered in-app; <span className="text-amber-400">In-app only</span> = rendered but no push.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadSmsTracked(false)}
          disabled={smsTrackedLoading}
          className="flex items-center gap-1.5 text-xs rounded-xl border border-[var(--color-brand-border)] px-3 py-1.5 text-[var(--color-brand-text-secondary)] hover:text-[var(--color-brand-text-primary)] disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${smsTrackedLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {smsTracked.length > 0 && (
        <div className="flex items-center gap-1.5">
          {([
            ['all', 'All', smsTracked.length],
            ['attention', 'Needs attention', failedCount + tappedCount],
            ['failed', 'Failed', failedCount],
          ] as const).map(([key, label, count]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`text-xs rounded-full px-2.5 py-1 border transition-colors ${
                filter === key
                  ? 'border-[var(--color-brand-text-primary)] text-[var(--color-brand-text-primary)]'
                  : 'border-[var(--color-brand-border)] text-[var(--color-brand-text-muted)] hover:text-[var(--color-brand-text-secondary)]'
              }`}
            >
              {label} <span className="font-mono opacity-70">{count}</span>
            </button>
          ))}
        </div>
      )}

      {pushDown && (
        <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-[var(--color-brand-red)] shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-[var(--color-brand-red)]">Push delivery is down</p>
            <p className="text-xs text-[var(--color-brand-text-secondary)] mt-0.5">
              <span className="font-mono">FIREBASE_SERVICE_ACCOUNT_JSON</span> is not set in the deployed environment — no one is receiving SMS push notifications. Set it in the Vercel project env to restore delivery.
            </p>
          </div>
        </div>
      )}

      {smsTrackedLoading && smsTracked.length === 0 && (
        <p className="text-xs text-[var(--color-brand-text-muted)] py-4 text-center">Loading…</p>
      )}

      {!smsTrackedLoading && smsTracked.length === 0 && (
        <p className="text-xs text-[var(--color-brand-text-muted)] py-4 text-center">No SMS tracked yet.</p>
      )}

      {smsTracked.length > 0 && (
        <div className="overflow-x-auto -mx-5 px-5">
          <table className="w-full min-w-96 text-xs">
            <thead>
              <tr className="border-b border-[var(--color-brand-border)]">
                <th className="text-left py-2 pr-3 font-semibold text-[var(--color-brand-text-muted)] uppercase tracking-wide text-[10px]">Status</th>
                <th className="text-left py-2 pr-3 font-semibold text-[var(--color-brand-text-muted)] uppercase tracking-wide text-[10px]">Transaction</th>
                <th className="text-left py-2 pr-3 font-semibold text-[var(--color-brand-text-muted)] uppercase tracking-wide text-[10px]">Sender</th>
                <th className="text-left py-2 pr-3 font-semibold text-[var(--color-brand-text-muted)] uppercase tracking-wide text-[10px]">User</th>
                <th className="text-center py-2 pr-3 font-semibold text-[var(--color-brand-text-muted)] uppercase tracking-wide text-[10px]">Method</th>
                <th className="text-center py-2 pr-3 font-semibold text-[var(--color-brand-text-muted)] uppercase tracking-wide text-[10px]">Push</th>
                <th className="text-center py-2 pr-3 font-semibold text-[var(--color-brand-text-muted)] uppercase tracking-wide text-[10px]">In-app</th>
                <th className="text-right py-2 pr-3 font-semibold text-[var(--color-brand-text-muted)] uppercase tracking-wide text-[10px]">When</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => {
                const isExpanded = expandedId === row.id
                const displayName = row.clean_title ?? row.merchant ?? row.bank_name ?? row.sender ?? '—'
                const method = row.parse_method ? METHOD_CHIPS[row.parse_method] : null
                const chip = statusChip(row)
                const isFailureState = row.status === 'rejected' || row.status === 'failed' || row.status === 'add_failed'

                return (
                  <Fragment key={row.id}>
                    <tr
                      onClick={() => setExpandedId(isExpanded ? null : row.id)}
                      className="border-b border-[var(--color-brand-border)] hover:bg-[var(--color-brand-elevated)] transition-colors cursor-pointer"
                    >
                      <td className="py-2.5 pr-3">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border whitespace-nowrap ${chip.cls}`}>
                          {chip.ok && <CheckCircle2 className="h-2.5 w-2.5" />}
                          {chip.label}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 max-w-56">
                        <span className="block truncate text-[var(--color-brand-text-primary)] font-medium">
                          {row.amount != null && row.currency ? `${row.currency} ${row.amount.toLocaleString()} · ` : ''}{displayName}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 whitespace-nowrap text-[var(--color-brand-text-secondary)]">
                        {row.sender ?? '—'}
                      </td>
                      <td className="py-2.5 pr-3 max-w-40">
                        <span className="block truncate text-[var(--color-brand-text-secondary)]" title={row.email ?? row.user_id}>
                          {row.email ?? `${row.user_id.slice(0, 8)}…`}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-center">
                        {method && (
                          <span className={`font-mono text-xs px-1.5 py-0.5 rounded border ${method.cls}`}>
                            {method.label}
                          </span>
                        )}
                        {row.parse_method === 'ai' && row.learn_status && (() => {
                          const lc = LEARN_CHIPS[row.learn_status] ?? {
                            label: row.learn_status,
                            cls: 'border-[var(--color-brand-border)] text-[var(--color-brand-text-muted)] bg-[var(--color-brand-elevated)]',
                          }
                          return (
                            <span
                              title={`AI learning: ${row.learn_status}`}
                              className={`block mt-1 mx-auto w-fit font-mono text-xs px-1 py-0.5 rounded border ${lc.cls}`}
                            >
                              {lc.label}
                            </span>
                          )
                        })()}
                      </td>
                      <td className="py-2.5 pr-3 text-center">{pushCell(row)}</td>
                      <td className="py-2.5 pr-3 text-center">{inAppCell(row)}</td>
                      <td className="py-2.5 pr-3 text-right whitespace-nowrap text-[var(--color-brand-text-muted)]">
                        {new Date(row.received_at).toLocaleString()}
                      </td>
                      <td className="py-2.5 pl-1 text-center">
                        <ChevronDown className={`h-3.5 w-3.5 text-[var(--color-brand-text-muted)] transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr className="border-b border-[var(--color-brand-border)] bg-[var(--color-brand-bg)]/40">
                        <td colSpan={9} className="px-3 py-3">
                          <p className="text-[10px] font-semibold text-[var(--color-brand-text-muted)] uppercase tracking-wider mb-1.5">Raw SMS Body</p>
                          <pre className="text-[10px] text-[var(--color-brand-text-secondary)] whitespace-pre-wrap break-all bg-[var(--color-brand-bg)] rounded-lg p-2.5 max-h-40 overflow-y-auto font-mono leading-relaxed">
                            {row.raw_body}
                          </pre>

                          {isFailureState && row.failure_code && (
                            <p className="text-[10px] text-amber-400 mt-2">
                              {row.status === 'failed' ? 'Failure' : 'Rejected'}: {FAILURE_LABELS[row.failure_code] ?? row.failure_code} <span className="font-mono">({row.failure_code})</span>
                            </p>
                          )}

                          <p className="text-[10px] text-[var(--color-brand-text-muted)] mt-2">
                            Delivery: <span className="font-mono">{row.status}</span>
                            {row.pushed_at ? ` · pushed ${new Date(row.pushed_at).toLocaleTimeString()}` : ' · not pushed'}
                            {row.acked_at ? ` · rendered ${new Date(row.acked_at).toLocaleTimeString()}` : ' · not rendered'}
                            {row.confirmed_at ? ` · confirmed ${new Date(row.confirmed_at).toLocaleTimeString()}` : ''}
                            {row.push_result
                              ? row.push_result.error
                                ? ` · push error: ${row.push_result.error}`
                                : ` · push sent ${row.push_result.sent ?? 0}, failed ${row.push_result.failed ?? 0}`
                              : ''}
                          </p>

                          <p className="text-[10px] text-[var(--color-brand-text-muted)] mt-1.5">
                            {row.confidence != null ? `${Math.round(row.confidence * 100)}% conf` : ''}
                            {row.kind ? ` · ${row.kind}` : ''}
                            {row.source ? ` · via ${row.source}` : ''}
                            {row.account_last4 ? ` · ••••${row.account_last4}` : ''}
                            {row.payment_instrument ? ` · ${row.payment_instrument}` : ''}
                            {row.pattern_id ? ` · pattern: ${row.pattern_id}` : ''}
                            {row.expense_id ? ' · expense linked' : ''}
                            {row.income_id ? ' · income linked' : ''}
                          </p>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {smsTrackedCursor && (
        <button
          type="button"
          onClick={() => void loadSmsTracked(true)}
          disabled={smsTrackedLoading}
          className="w-full flex items-center justify-center gap-1.5 text-xs rounded-xl border border-[var(--color-brand-border)] py-2 text-[var(--color-brand-text-muted)] hover:text-[var(--color-brand-text-secondary)] disabled:opacity-50 transition-colors"
        >
          {smsTrackedLoading ? 'Loading…' : 'Load more'}
        </button>
      )}
    </section>
  )
}
