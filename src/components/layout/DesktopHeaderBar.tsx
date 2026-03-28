'use client'

import Link from 'next/link'
import { PAGE_HEADER_SURFACE_BASE } from '@/components/layout/PageHeader'
import { AuthNavButtons } from '@/components/layout/AuthNavButtons'
import { MonthNavigationControl } from '@/components/layout/MonthNavigationControl'
import { useSettingsStore } from '@/lib/store/useSettingsStore'

/** Fixed top bar: mobile = logo + month nav + bell/profile; desktop = spacer + full auth row. */
export function DesktopHeaderBar() {
  const { monthFilter, setMonthFilter } = useSettingsStore()

  return (
    <header
      className={`flex flex-nowrap fixed top-0 left-0 right-0 lg:left-[200px] z-40 h-[52px] items-center gap-2 px-4 lg:px-6 border-b border-[var(--color-brand-border)] ${PAGE_HEADER_SURFACE_BASE}`}
    >
      <div className="flex lg:hidden w-full min-w-0 items-center">
        <div className="flex flex-1 min-w-0 justify-start items-center">
          <Link
            href="/"
            className="shrink-0 text-xl font-bold font-heading tracking-tight text-white"
          >
            Bud<span className="text-[var(--color-brand-red)]">d</span>get
          </Link>
        </div>
        <div className="flex flex-1 min-w-0 justify-center items-center px-0.5">
          <MonthNavigationControl monthFilter={monthFilter} onChange={setMonthFilter} />
        </div>
        <div className="flex flex-1 min-w-0 justify-end items-center">
          <AuthNavButtons layout="mobile" />
        </div>
      </div>

      <div className="hidden lg:flex flex-1 min-w-0 items-center justify-end">
        <div className="flex-1 min-w-0" aria-hidden />
        <AuthNavButtons layout="desktop" />
      </div>
    </header>
  )
}
