'use client'

import { AppLink as Link } from '@/components/ui/AppLink'
import { DollarSign, PiggyBank } from 'lucide-react'
import { useT } from '@/lib/i18n'

/**
 * Shortcuts to Income and Savings full pages from settings.
 */
export function SettingsPageLinksSection() {
  const t = useT()

  return (
    <>
      <section className="glass-card rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <DollarSign className="w-5 h-5 text-[var(--color-brand-red)]" />
          <h2 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider">{t.settings.pageLinksIncomeTitle}</h2>
        </div>
        <p className="text-xs text-[var(--color-brand-text-muted)]">
          {t.settings.pageLinksIncomeDesc}
        </p>
        <Link
          href="/income"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--color-brand-border)] text-sm text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)] transition-colors"
        >
          {t.settings.pageLinksIncomeLink}
        </Link>
      </section>

      <section className="glass-card rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <PiggyBank className="w-5 h-5 text-[var(--color-brand-red)]" />
          <h2 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider">{t.settings.pageLinksSavingsTitle}</h2>
        </div>
        <p className="text-xs text-[var(--color-brand-text-muted)]">{t.settings.pageLinksSavingsDesc}</p>
        <Link
          href="/savings"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--color-brand-border)] text-sm text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)] transition-colors"
        >
          {t.settings.pageLinksSavingsLink}
        </Link>
      </section>
    </>
  )
}
