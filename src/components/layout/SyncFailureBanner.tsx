'use client'

import { useState } from 'react'
import { AlertTriangle, ChevronDown, X } from 'lucide-react'
import { useSyncFailures } from '@/lib/store/useSyncFailures'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n'

/**
 * Slim inline banner that surfaces Supabase sync failures the user
 * wouldn't otherwise notice. The sync layer swallows per-table errors
 * (FK constraints, RLS denials, network blips) — before this banner,
 * a row could live forever in local Zustand state while the server
 * never received it. That's how "my income disappeared after
 * onboarding" snuck past for a week.
 *
 * Retry is automatic: the sync layer re-fires the same diff on every
 * subsequent store change because `prevSnap.current` doesn't advance
 * on failure. This banner just lets the user know something is stuck
 * and gives them a way to dismiss it.
 */
export function SyncFailureBanner() {
  const failures = useSyncFailures((s) => s.failures)
  const clear = useSyncFailures((s) => s.clear)
  const t = useT()
  const [expanded, setExpanded] = useState(false)

  if (failures.length === 0) return null

  const primary = failures[0]

  return (
    <div className="px-4 pt-2">
      <div
        role="status"
        aria-live="polite"
        className={cn(
          'rounded-xl border px-3 py-2 text-xs',
          'border-[var(--color-brand-amber)]/30 bg-[var(--color-brand-amber)]/10 text-[var(--color-brand-text-primary)]',
        )}
      >
        <div className="flex items-start gap-2">
          <AlertTriangle
            className="h-4 w-4 shrink-0 text-[var(--color-brand-amber)] mt-0.5"
            aria-hidden
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium text-[var(--color-brand-text-primary)]">
                {failures.length === 1
                  ? t.syncFailures.oneDidntSync
                  : t.syncFailures.manyDidntSync(failures.length)}
              </p>
              <div className="flex items-center gap-1 shrink-0">
                {failures.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setExpanded((v) => !v)}
                    className="p-1 rounded hover:bg-[var(--color-brand-amber)]/20 transition-colors"
                    aria-label={expanded ? t.syncFailures.collapse : t.syncFailures.expand}
                  >
                    <ChevronDown
                      className={cn(
                        'h-3.5 w-3.5 text-[var(--color-brand-text-muted)] transition-transform',
                        expanded && 'rotate-180',
                      )}
                      aria-hidden
                    />
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={clear}
                  className="p-1 rounded hover:bg-[var(--color-brand-amber)]/20 transition-colors"
                  aria-label={t.syncFailures.dismiss}
                >
                  <X className="h-3.5 w-3.5 text-[var(--color-brand-text-muted)]" aria-hidden />
                </button>
              </div>
            </div>
            <p className="mt-0.5 text-[var(--color-brand-text-secondary)]">
              {t.syncFailures.autoRetryNote}
            </p>
            {expanded ? (
              <ul className="mt-2 space-y-1 text-[11px] text-[var(--color-brand-text-muted)] font-mono">
                {failures.map((f, i) => (
                  <li key={`${f.label}-${i}`} className="truncate">
                    <span className="text-[var(--color-brand-text-secondary)]">{f.label}</span>
                    {f.attemptCount > 1 ? (
                      <span className="ms-1 text-[var(--color-brand-text-muted)]">×{f.attemptCount}</span>
                    ) : null}
                    <span className="ms-2">{f.message}</span>
                  </li>
                ))}
              </ul>
            ) : primary ? (
              <p className="mt-0.5 truncate text-[11px] text-[var(--color-brand-text-muted)] font-mono">
                {primary.label}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
