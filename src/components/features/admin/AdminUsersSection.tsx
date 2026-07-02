'use client'

import { Users } from 'lucide-react'
import type { AdminPanelModel } from '@/hooks/useAdminPanel'

export interface AdminUsersSectionProps {
  admin: AdminPanelModel
}

/**
 * Lists Supabase users (requires service role on server).
 */
export function AdminUsersSection({ admin }: AdminUsersSectionProps) {
  return (
    <section className="glass-card rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Users className="w-5 h-5 text-[var(--color-brand-red)]" />
        <h2 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider">
          Users (Supabase)
        </h2>
      </div>
      <p className="text-[11px] text-[var(--color-brand-text-muted)]">
        Requires <code className="text-[var(--color-brand-text-secondary)]">SUPABASE_SERVICE_ROLE_KEY</code> on the
        server.
      </p>
      <button
        type="button"
        disabled={admin.usersLoading || !admin.sessionPin}
        onClick={() => void admin.loadUsers()}
        className="text-xs px-3 py-2 rounded-xl bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] hover:border-[var(--color-brand-red)]/40 disabled:opacity-50"
      >
        {admin.usersLoading ? 'Loading…' : 'Load users'}
      </button>
      {admin.users.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-[var(--color-brand-border)] max-h-72 overflow-y-auto">
          <table className="w-full text-start text-[11px]">
            <thead className="sticky top-0 bg-[var(--color-brand-bg)] text-[var(--color-brand-text-muted)]">
              <tr>
                <th className="p-2 font-medium">Email</th>
                <th className="p-2 font-medium">Last sign-in</th>
              </tr>
            </thead>
            <tbody>
              {admin.users.map((u) => (
                <tr key={u.id} className="border-t border-[var(--color-brand-border)]">
                  <td className="p-2 text-[var(--color-brand-text-primary)] font-mono-numbers">{u.email || u.id.slice(0, 8)}</td>
                  <td className="p-2 text-[var(--color-brand-text-secondary)]">
                    {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  )
}
