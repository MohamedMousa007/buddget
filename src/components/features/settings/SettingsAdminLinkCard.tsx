'use client'

import Link from 'next/link'
import { Shield } from 'lucide-react'

/**
 * Link card to the operator admin panel.
 */
export function SettingsAdminLinkCard() {
  return (
    <section className="glass-card rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-[var(--color-brand-red)]" />
          <div>
            <p className="text-sm text-white">Admin Dashboard</p>
            <p className="text-xs text-[var(--color-brand-text-muted)]">Manage AI settings, server config, and more</p>
          </div>
        </div>
        <Link
          href="/admin"
          className="px-4 py-2 rounded-lg border border-[var(--color-brand-border)] text-sm text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)] transition-colors"
        >
          Go to Admin →
        </Link>
      </div>
    </section>
  )
}
