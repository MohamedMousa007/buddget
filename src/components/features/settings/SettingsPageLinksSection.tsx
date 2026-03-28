'use client'

import Link from 'next/link'
import { DollarSign, PiggyBank } from 'lucide-react'

/**
 * Shortcuts to Income and Savings full pages from settings.
 */
export function SettingsPageLinksSection() {
  return (
    <>
      <section className="glass-card rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <DollarSign className="w-5 h-5 text-[var(--color-brand-red)]" />
          <h2 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider">Income</h2>
        </div>
        <p className="text-xs text-[var(--color-brand-text-muted)]">
          Manage salary and other income on the dedicated Income page (add, edit, delete).
        </p>
        <Link
          href="/income"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--color-brand-border)] text-sm text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)] transition-colors"
        >
          Open Income →
        </Link>
      </section>

      <section className="glass-card rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <PiggyBank className="w-5 h-5 text-[var(--color-brand-red)]" />
          <h2 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider">Savings</h2>
        </div>
        <p className="text-xs text-[var(--color-brand-text-muted)]">Holdings and savings buckets live on the Savings page.</p>
        <Link
          href="/savings"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--color-brand-border)] text-sm text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)] transition-colors"
        >
          Open Savings →
        </Link>
      </section>
    </>
  )
}
