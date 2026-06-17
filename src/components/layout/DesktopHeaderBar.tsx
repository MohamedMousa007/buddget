'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart3 } from 'lucide-react'
import { AuthNavButtons } from '@/components/layout/AuthNavButtons'
import { MonthNavigationControl } from '@/components/layout/MonthNavigationControl'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { useLocale, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { sectionTitleNavKey } from '@/lib/navigation/bottomNavConfig'

export function DesktopHeaderBar() {
  const { monthFilter, setMonthFilter } = useSettingsStore()
  const pathname = usePathname()
  const t = useT()
  const { locale } = useLocale()
  const sectionKey = sectionTitleNavKey(pathname)
  const sectionTitle = sectionKey ? t.nav[sectionKey] : ''
  const isHome = pathname === '/'

  return (
    <>
      {/* ─── Desktop header (lg+) ─── */}
      <header className="hidden lg:flex fixed top-0 start-[176px] end-0 z-40 h-12 items-center justify-between px-6 bg-[var(--color-brand-card)]/90 border-b border-[var(--color-brand-border)] backdrop-blur-xl">
        <div className="flex items-center shrink-0">
          {pathname === '/' && (
            <Link
              href="/reports"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-brand-elevated)] text-sm text-[var(--color-brand-text-primary)] hover:bg-[var(--color-brand-border)] transition-colors"
            >
              <BarChart3 className="w-4 h-4 shrink-0" />
              <span className={locale === 'ar' ? 'text-end' : undefined}>{t.nav.reports}</span>
            </Link>
          )}
        </div>

        <div className="absolute left-1/2 -translate-x-1/2">
          {pathname === '/' && (
            <MonthNavigationControl monthFilter={monthFilter} onChange={setMonthFilter} />
          )}
        </div>

        <div className="flex items-center shrink-0">
          <AuthNavButtons layout="desktop" />
        </div>
      </header>

      {/* ─── Mobile header (<lg) ─── */}
      <header className="flex lg:hidden fixed top-0 start-0 end-0 z-40 min-h-[calc(52px+env(safe-area-inset-top,0px))] flex-col bg-[var(--color-brand-bg)] border-b border-[var(--color-brand-border)] safe-area-top">
        <div className="flex h-[52px] shrink-0 items-center gap-[9px] px-[18px]">
          <Link
            href="/"
            className="shrink-0 text-[19px] font-extrabold font-heading tracking-[-0.4px] text-[var(--color-brand-text-primary)]"
          >
            Bud<span className="text-[var(--color-brand-red)]">d</span>get
          </Link>
          {sectionTitle && (
            <>
              <span className="h-4 w-px shrink-0 bg-[var(--color-brand-border)]" />
              <span className="min-w-0 truncate text-sm font-semibold text-[var(--color-brand-text-secondary)]">
                {sectionTitle}
              </span>
            </>
          )}

          {/* Home keeps its month switcher in-header (dashboard is out of scope). */}
          {isHome && (
            <div className="ms-auto flex min-w-0 items-center">
              <MonthNavigationControl monthFilter={monthFilter} onChange={setMonthFilter} compact />
            </div>
          )}

          <div className={cn('flex shrink-0 items-center', isHome ? 'ms-2' : 'ms-auto')}>
            <AuthNavButtons layout="mobile" />
          </div>
        </div>
      </header>
    </>
  )
}
