'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart3 } from 'lucide-react'
import { AuthNavButtons } from '@/components/layout/AuthNavButtons'
import { MonthNavigationControl } from '@/components/layout/MonthNavigationControl'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { useT } from '@/lib/i18n'

export function DesktopHeaderBar() {
  const { monthFilter, setMonthFilter } = useSettingsStore()
  const pathname = usePathname()
  const t = useT()

  return (
    <>
      {/* ─── Desktop header (lg+) ─── */}
      <header className="hidden lg:flex fixed top-0 start-[200px] end-0 z-40 h-14 items-center justify-between px-8 bg-[#111118]/90 border-b border-[#2A2A38] backdrop-blur-xl">
        <div className="flex items-center shrink-0">
          {pathname === '/' && (
            <Link
              href="/reports"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-brand-elevated)] text-sm text-white hover:bg-[var(--color-brand-border)] transition-colors"
            >
              <BarChart3 className="w-4 h-4" />
              <span>{t.nav.reports}</span>
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
      <header className="flex lg:hidden fixed top-0 start-0 end-0 z-40 h-14 items-center px-4 bg-[#111118]/90 border-b border-[#2A2A38] backdrop-blur-xl">
        <div className="flex flex-1 min-w-0 justify-start items-center">
          <Link
            href="/"
            className="shrink-0 text-xl font-bold font-heading tracking-tight text-white"
          >
            Bud<span className="text-[var(--color-brand-red)]">d</span>get
          </Link>
        </div>

        <div className="flex flex-1 min-w-0 justify-center items-center">
          {pathname === '/' && (
            <MonthNavigationControl monthFilter={monthFilter} onChange={setMonthFilter} compact />
          )}
        </div>

        <div className="flex flex-1 min-w-0 justify-end items-center">
          <AuthNavButtons layout="mobile" />
        </div>
      </header>
    </>
  )
}
