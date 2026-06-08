'use client'

import { useEffect, useState } from 'react'
import { RefreshCw, ChevronDown } from 'lucide-react'
import type { AdminPanelModel } from '@/hooks/useAdminPanel'

interface Props {
  admin: AdminPanelModel
}

const FAILURE_LABELS: Record<string, string> = {
  gemini_error: 'AI error',
  not_transaction: 'Not a transaction',
  null_amount: 'No amount',
  low_confidence: 'Low confidence',
  duplicate: 'Duplicate',
  log_insert_failed: 'Save failed',
  parse_exception: 'Parse crash',
}

const FAILURE_COLORS: Record<string, string> = {
  gemini_error: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  not_transaction: 'bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-muted)] border-[var(--color-brand-border)]',
  null_amount: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  low_confidence: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  duplicate: 'bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-muted)] border-[var(--color-brand-border)]',
  log_insert_failed: 'bg-red-500/10 text-[var(--color-brand-red)] border-red-500/20',
  parse_exception: 'bg-red-500/10 text-[var(--color-brand-red)] border-red-500/20',
}

export function AdminSmsErrorQueue({ admin }: Props) {
  const { smsErrors, smsErrorsLoading, smsErrorsCursor, loadSmsErrors } = admin
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    void loadSmsErrors(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <section className="glass-card rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-[var(--color-brand-text-primary)]">
            SMS Error Queue
          </h2>
          <p className="text-xs text-[var(--color-brand-text-muted)] mt-0.5">
            All SMS parse failures — including skipped, low-confidence, and crash rows.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadSmsErrors(false)}
          disabled={smsErrorsLoading}
          className="flex items-center gap-1.5 text-xs rounded-xl border border-[var(--color-brand-border)] px-3 py-1.5 text-[var(--color-brand-text-secondary)] hover:text-[var(--color-brand-text-primary)] disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${smsErrorsLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {smsErrorsLoading && smsErrors.length === 0 && (
        <p className="text-xs text-[var(--color-brand-text-muted)] py-4 text-center">Loading…</p>
      )}

      {!smsErrorsLoading && smsErrors.length === 0 && (
        <p className="text-xs text-[var(--color-brand-text-muted)] py-4 text-center">
          No failures in the log. All SMS parsed successfully.
        </p>
      )}

      {smsErrors.length > 0 && (
        <div className="space-y-2">
          {smsErrors.map((row) => {
            const code = row.failure_code ?? 'unknown'
            const label = FAILURE_LABELS[code] ?? code
            const colorClass = FAILURE_COLORS[code] ?? FAILURE_COLORS.log_insert_failed
            const isExpanded = expandedId === row.id
            const displayName = row.clean_title ?? row.merchant ?? row.bank_name ?? row.sender ?? '—'

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
                  {/* Failure code chip */}
                  <span className={`shrink-0 mt-0.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${colorClass}`}>
                    {label}
                  </span>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[var(--color-brand-text-primary)] truncate">
                      {row.amount != null && row.currency
                        ? `${row.currency} ${row.amount.toLocaleString()} · `
                        : ''}
                      {displayName}
                    </p>
                    <p className="text-[10px] text-[var(--color-brand-text-muted)]">
                      {row.sender ?? 'unknown sender'} · {row.confidence != null ? `${Math.round(row.confidence * 100)}% conf · ` : ''}
                      {new Date(row.received_at).toLocaleString()}
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
                    <p className="text-[10px] text-[var(--color-brand-text-muted)] mt-2">
                      User: <span className="font-mono">{row.user_id.slice(0, 8)}…</span>
                      {row.is_duplicate ? ' · Duplicate' : ''}
                      {row.kind ? ` · ${row.kind}` : ''}
                    </p>
                  </div>
                )}
              </div>
            )
          })}

          {smsErrorsCursor && (
            <button
              type="button"
              onClick={() => void loadSmsErrors(true)}
              disabled={smsErrorsLoading}
              className="w-full flex items-center justify-center gap-1.5 text-xs rounded-xl border border-[var(--color-brand-border)] py-2 text-[var(--color-brand-text-muted)] hover:text-[var(--color-brand-text-secondary)] disabled:opacity-50 transition-colors"
            >
              {smsErrorsLoading ? 'Loading…' : 'Load more'}
            </button>
          )}
        </div>
      )}
    </section>
  )
}
