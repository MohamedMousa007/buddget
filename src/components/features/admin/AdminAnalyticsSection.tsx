'use client'

import { BarChart3 } from 'lucide-react'
import type { AdminPanelModel } from '@/hooks/useAdminPanel'

export interface AdminAnalyticsSectionProps {
  admin: AdminPanelModel
}

/**
 * Approximate usage analytics joined with loaded users.
 */
export function AdminAnalyticsSection({ admin }: AdminAnalyticsSectionProps) {
  return (
    <section className="glass-card rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <BarChart3 className="w-5 h-5 text-[var(--color-brand-red)]" />
        <h2 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider">
          Usage (approx.)
        </h2>
      </div>
      <p className="text-[11px] text-[var(--color-brand-text-muted)]">
        Heartbeats while the app tab is visible (~45s chunks). Not exact device screen time.
      </p>
      <button
        type="button"
        disabled={admin.analyticsLoading || !admin.sessionPin}
        onClick={() => void admin.loadAnalytics()}
        className="text-xs px-3 py-2 rounded-xl bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] text-white hover:border-[var(--color-brand-red)]/40 disabled:opacity-50"
      >
        {admin.analyticsLoading ? 'Loading…' : 'Load last 7 days'}
      </button>
      {admin.analytics && admin.users.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-[var(--color-brand-border)] max-h-72 overflow-y-auto">
          <table className="w-full text-start text-[11px]">
            <thead className="sticky top-0 bg-[var(--color-brand-bg)] text-[var(--color-brand-text-muted)]">
              <tr>
                <th className="p-2 font-medium">User</th>
                <th className="p-2 font-medium">Sessions</th>
                <th className="p-2 font-medium">~Engaged</th>
              </tr>
            </thead>
            <tbody>
              {admin.users.map((u) => {
                const row = admin.analytics?.byUser[u.id]
                return (
                  <tr key={u.id} className="border-t border-[var(--color-brand-border)]">
                    <td className="p-2 text-white font-mono-numbers">{u.email || u.id.slice(0, 8)}</td>
                    <td className="p-2">{row?.sessionStarts ?? 0}</td>
                    <td className="p-2 text-[var(--color-brand-text-secondary)]">
                      {row ? `${Math.round(row.engagedSecondsApprox / 60)} min` : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : admin.analytics ? (
        <p className="text-[11px] text-[var(--color-brand-text-muted)]">
          Load users first to map analytics rows to emails.
        </p>
      ) : null}
    </section>
  )
}
