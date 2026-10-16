'use client'

import { AppLink as Link } from '@/components/ui/AppLink'
import { useNavPath } from '@/lib/navigation/navStore'
import { AuthNavButtons } from '@/components/layout/AuthNavButtons'
import { MonthNavigationControl } from '@/components/layout/MonthNavigationControl'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { sectionTitleNavKey } from '@/lib/navigation/bottomNavConfig'
import { ownsHeader } from '@/lib/navigation/ownsHeader'
import { BuddgetWordmark } from '@/components/brand'
import { SetupProgressChip } from '@/components/features/setup/SetupProgressChip'

export function DesktopHeaderBar() {
  const { monthFilter, setMonthFilter } = useSettingsStore()
  const pathname = useNavPath()
  const t = useT()
  const sectionKey = sectionTitleNavKey(pathname)
  const sectionTitle = sectionKey ? t.nav[sectionKey] : ''
  const isHome = pathname === '/'

  return (
    <>
      {/* ─── Desktop header (lg+) ─── */}
      <header className="hidden lg:flex fixed top-0 start-44 end-0 z-40 h-12 items-center justify-between px-6 bg-[var(--color-brand-card)]/90 border-b border-[var(--color-brand-border)] backdrop-blur-xl">
        <div className="flex items-center shrink-0">
        </div>

        <div className="flex items-center shrink-0 gap-1">
          <SetupProgressChip />
          <AuthNavButtons layout="desktop" />
        </div>
      </header>

      {/* ─── Mobile header (<lg) ─── Flow and Paydays draw their own. */}
      {ownsHeader(pathname) ? null : (
      <header className="flex lg:hidden fixed top-0 start-0 end-0 z-40 min-h-[calc(52px+env(safe-area-inset-top,0px))] flex-col bg-[var(--color-brand-bg)] border-b border-[var(--color-brand-border)] safe-area-top">
        <div className="flex h-14 shrink-0 items-center gap-2.5 px-5">
          <Link href="/" className="shrink-0">
            <BuddgetWordmark height={24} />
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

          <div className={cn('flex shrink-0 items-center gap-1', isHome ? 'ms-2' : 'ms-auto')}>
            <SetupProgressChip />
            <AuthNavButtons layout="mobile" />
          </div>
        </div>
      </header>
      )}
    </>
  )
}
