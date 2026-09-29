'use client'

import { AppLink as Link } from '@/components/ui/AppLink'
import { DollarSign, Coins } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
          <DollarSign className="w-5 h-5 text-[var(--color-brand-primary-ink)]" />
          <h2 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider">{t.settings.pageLinksIncomeTitle}</h2>
        </div>
        <p className="text-xs text-[var(--color-brand-text-muted)]">
          {t.settings.pageLinksIncomeDesc}
        </p>
        <Button render={<Link href="/income" />} variant="outline" size="touch" className="w-fit">
          {t.settings.pageLinksIncomeLink}
        </Button>
      </section>

      <section className="glass-card rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Coins className="w-5 h-5 text-[var(--color-brand-primary-ink)]" />
          <h2 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider">{t.settings.pageLinksSavingsTitle}</h2>
        </div>
        <p className="text-xs text-[var(--color-brand-text-muted)]">{t.settings.pageLinksSavingsDesc}</p>
        <Button render={<Link href="/wealth" />} variant="outline" size="touch" className="w-fit">
          {t.settings.pageLinksSavingsLink}
        </Button>
      </section>
    </>
  )
}
