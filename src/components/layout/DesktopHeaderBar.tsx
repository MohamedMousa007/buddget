'use client'

import { AppLink as Link } from '@/components/ui/AppLink'
import { useNavPath } from '@/lib/navigation/navStore'
import { AuthNavButtons } from '@/components/layout/AuthNavButtons'
import { useT } from '@/lib/i18n'
import { sectionTitleNavKey } from '@/lib/navigation/bottomNavConfig'
import { ownsHeader } from '@/lib/navigation/ownsHeader'
import { BuddgetWordmark } from '@/components/brand'
import { HIT_AREA } from '@/lib/ui/hitArea'
import { cn } from '@/lib/utils'

export function DesktopHeaderBar() {
  const pathname = useNavPath()
  const t = useT()
  const sectionKey = sectionTitleNavKey(pathname)
  const sectionTitle = sectionKey ? t.nav[sectionKey] : ''
  const desktopTitle = pathname.startsWith('/notifications') ? t.notifications.title : sectionTitle

  return (
    <>
      {/* ─── Desktop header (lg+) ─── */}
      <header className="hidden lg:flex fixed top-0 start-[var(--sidebar-w)] end-0 z-40 h-[var(--app-header-h-lg)] items-center justify-between px-6 bg-[var(--color-brand-card)]/90 border-b border-[var(--color-brand-border)] backdrop-blur-xl">
        {desktopTitle && !pathname.startsWith('/notifications') ? (
          <h1 className="min-w-0 truncate text-base font-semibold text-[var(--color-brand-text-primary)]">
            {desktopTitle}
          </h1>
        ) : (
          <span />
        )}

        <div className="flex items-center shrink-0 gap-1">
          <AuthNavButtons layout="desktop" />
        </div>
      </header>

      {/* ─── Mobile header (<lg) ─── Flow and Paydays draw their own. */}
      {ownsHeader(pathname) ? (
        sectionTitle ? <h1 className="sr-only lg:hidden">{sectionTitle}</h1> : null
      ) : (
      <header className="flex lg:hidden fixed top-0 start-0 end-0 z-40 min-h-[calc(var(--app-header-h)+env(safe-area-inset-top,0px))] flex-col bg-[var(--color-brand-bg)] border-b border-[var(--color-brand-border)] safe-area-top">
        <div className="flex h-14 shrink-0 items-center gap-2.5 px-5">
          <Link href="/" aria-label={t.common.homeLink} className={cn('shrink-0 outline-none', HIT_AREA, 'focus-visible:ring-2 focus-visible:ring-[var(--color-brand-focus)] rounded-sm')}>
            <BuddgetWordmark height={24} />
          </Link>
          {sectionTitle && (
            <>
              <span className="h-4 w-px shrink-0 bg-[var(--color-brand-border)]" />
              <h1 className="min-w-0 truncate text-sm font-semibold text-[var(--color-brand-text-secondary)]">
                {sectionTitle}
              </h1>
            </>
          )}

          <div className="ms-auto flex shrink-0 items-center gap-1">
            <AuthNavButtons layout="mobile" />
          </div>
        </div>
      </header>
      )}
    </>
  )
}
