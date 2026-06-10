'use client'

import { useEffect, useState } from 'react'
import { RefreshCw, ChevronDown, CheckCircle2 } from 'lucide-react'
import type { AdminPanelModel } from '@/hooks/useAdminPanel'
import type { SmsTrackedRow } from '@/types/admin'

interface Props {
  admin: AdminPanelModel
}

const UNDELIVERED_MS = 2 * 60 * 1000

/**
 * Single source of truth for the row chip. "Confirmed" (the app acked the
 * expense rendered) is the only true success. A row that the server logged or
 * pushed but the app never confirmed within 2 min is flagged "Not confirmed".
 */
function statusChip(row: SmsTrackedRow): { label: string; cls: string; ok?: boolean } {
  const undelivered =
    (row.status === 'logged' || row.status === 'notified') &&
    Date.now() - new Date(row.received_at).getTime() > UNDELIVERED_MS

  if (undelivered) {
    return { label: 'Not confirmed', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' }
  }
  switch (row.status) {
    case 'confirmed': return { label: 'Confirmed', cls: 'bg-green-500/10 text-green-400 border-green-500/20', ok: true }
    case 'notified':  return { label: 'Notified',  cls: 'bg-blue-500/10 text-blue-400 border-blue-500/20' }
    case 'logged':    return { label: 'Logged',    cls: 'bg-blue-500/10 text-blue-400 border-blue-500/20' }
    case 'processing':return { label: 'Processing',cls: 'bg-blue-500/10 text-blue-400 border-blue-500/20' }
    case 'rejected':  return { label: FAILURE_LABELS[row.failure_code ?? ''] ?? 'Rejected', cls: 'bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-muted)] border-[var(--color-brand-border)]' }
    case 'failed':    return { label: FAILURE_LABELS[row.failure_code ?? ''] ?? 'Failed', cls: 'bg-red-500/10 text-[var(--color-brand-red)] border-red-500/20' }
    default:          return { label: row.status, cls: 'bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-muted)] border-[var(--color-brand-border)]' }
  }
}

const FAILURE_LABELS: Record<string, string> = {
  gemini_error: 'AI error',
  not_transaction: 'Not a transaction',
  null_amount: 'No amount',
  low_confidence: 'Low confidence',
  duplicate: 'Duplicate',
  log_insert_failed: 'Save failed',
  parse_exception: 'Parse crash',
  processing: 'Processing',
  rate_limited: 'Rate limited',
  not_configured: 'AI not configured',
}

const METHOD_CHIPS: Record<string, { label: string; cls: string }> = {
  curated:  { label: 'Curated',  cls: 'border-green-500/20 text-green-400 bg-green-500/10' },
  promoted: { label: 'Promoted', cls: 'border-green-500/20 text-green-400 bg-green-500/10' },
  static:   { label: 'Learned',  cls: 'border-blue-500/20 text-blue-400 bg-blue-500/10' },
  ai:       { label: 'AI',       cls: 'border-amber-500/20 text-amber-400 bg-amber-500/10' },
}

export function AdminSmsTrackedSection({ admin }: Props) {
  const { smsTracked, smsTrackedLoading, smsTrackedCursor, loadSmsTracked } = admin
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    void loadSmsTracked(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <section className="glass-card rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-[var(--color-brand-text-primary)]">
            SMS Logs
          </h2>
          <p className="text-xs text-[var(--color-brand-text-muted)] mt-0.5">
            Complete log of every received SMS across all users — confirmed, notified, logged, rejected, and failed.
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

      {smsTrackedLoading && smsTracked.length === 0 && (
        <p className="text-xs text-[var(--color-brand-text-muted)] py-4 text-center">Loading…</p>
      )}

      {!smsTrackedLoading && smsTracked.length === 0 && (
        <p className="text-xs text-[var(--color-brand-text-muted)] py-4 text-center">
          No SMS tracked yet.
        </p>
      )}

      {smsTracked.length > 0 && (
        <div className="space-y-2">
          {smsTracked.map((row) => {
            const isExpanded = expandedId === row.id
            const displayName = row.clean_title ?? row.merchant ?? row.bank_name ?? row.sender ?? '—'
            const method = row.parse_method ? METHOD_CHIPS[row.parse_method] : null
            const chip = statusChip(row)
            const isFailureState = row.status === 'rejected' || row.status === 'failed'

            return (
              <div
                key={row.id}
                className="rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : row.id)}
                  className="w-full flex items-start gap-3 px-3 py-2.5 text-left hover:bg-white/5 transition-colors"
                >
                  {/* Status chip — derived from the real delivery status */}
                  <span className={`shrink-0 mt-0.5 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${chip.cls}`}>
                    {chip.ok && <CheckCircle2 className="h-2.5 w-2.5" />}
                    {chip.label}
                  </span>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[var(--color-brand-text-primary)] truncate">
                      {row.amount != null && row.currency
                        ? `${row.currency} ${row.amount.toLocaleString()} · `
                        : ''}
                      {displayName}
                    </p>
                    <p className="text-[10px] text-[var(--color-brand-text-muted)] flex items-center gap-1.5 flex-wrap">
                      {row.sender ?? 'unknown sender'} · {row.confidence != null ? `${Math.round(row.confidence * 100)}% conf · ` : ''}
                      {new Date(row.received_at).toLocaleString()}
                      {method && (
                        <span className={`font-mono text-[9px] px-1 py-0.5 rounded border ${method.cls}`}>
                          {method.label}
                        </span>
                      )}
                    </p>
                  </div>

                  <ChevronDown className={`shrink-0 h-3.5 w-3.5 text-[var(--color-brand-text-muted)] transition-transform mt-0.5 ${isExpanded ? 'rotate-180' : ''}`} />
                </button>

                {isExpanded && (
                  <div className="px-3 pb-3 pt-1 border-t border-[var(--color-brand-border)]">
                    <p className="text-[10px] font-semibold text-[var(--color-brand-text-muted)] uppercase tracking-wider mb-1.5">
                      Raw SMS Body
                    </p>
                    <pre className="text-[10px] text-[var(--color-brand-text-secondary)] whitespace-pre-wrap break-all bg-[var(--color-brand-bg)] rounded-lg p-2.5 max-h-40 overflow-y-auto font-mono leading-relaxed">
                      {row.raw_body}
                    </pre>
                    {isFailureState && row.failure_code && (
                      <p className="text-[10px] text-amber-400 mt-2">
                        {row.status === 'failed' ? 'Failure' : 'Rejected'}: {FAILURE_LABELS[row.failure_code] ?? row.failure_code} <span className="font-mono">({row.failure_code})</span>
                      </p>
                    )}

                    {/* Delivery diagnostics — why the user did or didn't get it */}
                    <p className="text-[10px] text-[var(--color-brand-text-muted)] mt-2">
                      Delivery: <span className="font-mono">{row.status}</span>
                      {row.pushed_at ? ` · pushed ${new Date(row.pushed_at).toLocaleTimeString()}` : ''}
                      {row.confirmed_at ? ` · confirmed ${new Date(row.confirmed_at).toLocaleTimeString()}` : ''}
                      {row.push_result
                        ? row.push_result.error
                          ? ` · push error: ${row.push_result.error}`
                          : ` · push sent ${row.push_result.sent ?? 0}, failed ${row.push_result.failed ?? 0}`
                        : ''}
                    </p>

                    <p className="text-[10px] text-[var(--color-brand-text-muted)] mt-2">
                      User: <span className="font-mono">{row.email ?? `${row.user_id.slice(0, 8)}…`}</span>
                      {row.kind ? ` · ${row.kind}` : ''}
                      {row.source ? ` · via ${row.source}` : ''}
                      {row.account_last4 ? ` · ••••${row.account_last4}` : ''}
                      {row.payment_instrument ? ` · ${row.payment_instrument}` : ''}
                      {row.pattern_id ? ` · pattern: ${row.pattern_id}` : ''}
                      {row.expense_id ? ' · expense linked' : ''}
                      {row.income_id ? ' · income linked' : ''}
                    </p>
                  </div>
                )}
              </div>
            )
          })}

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
        </div>
      )}
    </section>
  )
}
