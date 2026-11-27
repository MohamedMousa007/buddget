'use client'

import { useInsightsDot } from '@/lib/insights/useInsightsDot'
import { useEffect, useRef, useCallback, useState, type ComponentType, type RefObject } from 'react'
import { AppLink as Link } from '@/components/ui/AppLink'
import { useNavPath } from '@/lib/navigation/navStore'
import { BarChart3, Bell, CalendarClock, LogIn, Settings, ShieldCheck, Target } from 'lucide-react'
import { RotateCwClock } from '@/components/ui/icons/RotateCwClock'
import { Badge } from '@/components/ui/badge'
import { SetupChecklistSheet } from '@/components/features/setup/SetupProgressChip'
import { useSetupProgress } from '@/hooks/useSetupProgress'
import { useStaffAccess } from '@/hooks/useStaffAccess'
import { usePendingEntries } from '@/lib/alerts/usePending'
import { useShallow } from 'zustand/react/shallow'
import { useAuth } from '@/components/auth/AuthProvider'
import { MemberHead } from '@/components/features/membership/MemberHead'
import { ProPlanRow } from '@/components/features/membership/ProPlanRow'
import { Button } from '@/components/ui/button'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { resolveProfileAvatarSrc } from '@/lib/profile/avatarDisplay'
import { registerBackGuard } from '@/lib/navigation/backGuard'
import { navigate } from '@/lib/navigation/navigate'
import { cn } from '@/lib/utils'
import { localeInlineLabelClass, useLocale, useT } from '@/lib/i18n'
import { useSettingsHubCopy } from '@/lib/i18n/settingsHubCopy'

interface ProfileDropdownProps {
  open: boolean
  onClose: () => void
  /** Ref covering the toggle button + dropdown for outside-click detection */
  containerRef: RefObject<HTMLDivElement | null>
}

const itemClass =
  'flex w-full min-h-11 cursor-pointer items-center gap-3 px-4 py-2.5 text-start text-sm font-medium text-[var(--color-brand-text-secondary)] transition-colors duration-150 hover:bg-[var(--color-brand-elevated)] hover:text-[var(--color-brand-text-primary)]'

type Glyph = ComponentType<{ className?: string }>

function Divider() {
  return <div className="border-t border-[var(--color-brand-border)]" />
}

export function ProfileDropdown({ open, onClose, containerRef }: ProfileDropdownProps) {
  const pathname = useNavPath()
  const t = useT()
  const copy = useSettingsHubCopy()
  const { locale } = useLocale()
  const insightsDot = useInsightsDot()
  const { user, openAuthModal } = useAuth()
  const profile = useFinanceStore(useShallow((s) => s.profile))
  const isStaff = useStaffAccess()
  const prevPathname = useRef(pathname)
  const { pct } = useSetupProgress()
  const pendingCount = usePendingEntries().length
  const [setupOpen, setSetupOpen] = useState(false)

  // Hardware/gesture back closes the menu first instead of navigating the page.
  useEffect(() => {
    if (!open) return
    return registerBackGuard(() => { onClose(); return true })
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    // Use 'click' (not 'pointerdown') so the outside-click handler fires AFTER
    // any menu-item onClick has already committed — prevents unmounting the
    // dropdown before navigation fires on Android WebView.
    const handler = (e: MouseEvent) => {
      // A sheet opened from the menu (currency picker, confirm) is portalled outside it and owns its own dismissal.
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('click', handler, { capture: true })
    return () => document.removeEventListener('click', handler, { capture: true })
  }, [open, onClose, containerRef])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('[role="dialog"][aria-modal="true"]')) onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  useEffect(() => {
    if (pathname !== prevPathname.current) {
      onClose()
    }
    prevPathname.current = pathname
  }, [pathname, onClose])

  /**
   * Close the dropdown after navigation starts. The delay ensures the Link's
   * native anchor click commits first — critical on Capacitor Android WebView.
   */
  const delayedClose = useCallback(() => {
    setTimeout(onClose, 100)
  }, [onClose])

  if (!open && !setupOpen) return null

  const avatarSrc = resolveProfileAvatarSrc(profile)
  const tile = 'flex min-h-[60px] w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-xl bg-[var(--color-brand-elevated)] px-0.5 py-1.5 text-center text-[0.625rem] font-medium leading-tight text-[var(--color-brand-text-secondary)] transition-colors hover:bg-[var(--color-brand-sunken)] hover:text-[var(--color-brand-text-primary)] [&_svg]:size-[19px] [&_svg]:text-[var(--color-brand-primary-ink)]'
  const link = (href: string, Icon: Glyph, label: string) => (
    <Link key={href} href={href} onClick={delayedClose} className={`${tile} relative`} role="menuitem">
      <Icon />
      <span className={localeInlineLabelClass(locale)}>{label}</span>
      {href === '/reports' && insightsDot ? <span role="img" aria-label={t.insights.newBadge} className="absolute end-2 top-2 size-2 rounded-full bg-[var(--color-cat-3)]" /> : null}
    </Link>
  )

  return (
    <>
      <SetupChecklistSheet open={setupOpen} onClose={() => { setSetupOpen(false); onClose() }} />
      {open ? (
        <div
          className="native-scroll absolute end-0 top-full z-50 mt-2 max-h-[calc(100dvh-6rem)] w-[19rem] overflow-y-auto rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] shadow-[0_24px_50px_-16px_rgba(0,0,0,0.7)]"
          role="menu"
        >
          {user && pct < 100 ? (
            <>
              <button
                type="button"
                data-raw-button-ok="menu row sharing itemClass with the other profile menu items, tinted as the CTA"
                onClick={() => setSetupOpen(true)}
                aria-label={t.setup.chipAria(pct)}
                className={cn(itemClass, 'min-h-11 bg-[var(--color-brand-primary-soft)] font-semibold text-[var(--color-brand-primary-ink)] hover:bg-[var(--color-brand-primary-soft)]/70')}
                role="menuitem"
              >
                <span className={localeInlineLabelClass(locale)}>{t.setup.chipLabel}</span>
                <span aria-hidden className="h-1 flex-1 overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--color-brand-primary)_22%,transparent)]"><span className="block h-full bg-[var(--color-brand-primary)]" style={{ width: `${pct}%` }} /></span>
                <span className="font-mono-numbers text-xs">{pct}%</span>
              </button>
              <Divider />
            </>
          ) : null}
          {user ? (
            <MemberHead
              variant="menu"
              name={profile.name}
              avatarSrc={avatarSrc}
              onNavigate={delayedClose}
              trailing={
                <Link
                  href="/notifications"
                  onClick={delayedClose}
                  role="menuitem"
                  aria-label={pendingCount > 0 ? `${t.notifications.title}, ${t.notifications.needsYouCount(pendingCount)}` : t.notifications.title}
                  className="relative flex size-11 shrink-0 items-center justify-center rounded-full text-[var(--color-brand-text-secondary)] transition-colors hover:bg-[var(--color-brand-elevated)]"
                >
                  <Bell className="size-5" />
                  {pendingCount > 0 ? (
                    <Badge tone="warn" size="xs" className="absolute -end-0.5 -top-0.5">{pendingCount}</Badge>
                  ) : null}
                </Link>
              }
            />
          ) : (
            <button
              type="button"
              data-raw-button-ok="menu row sharing itemClass, tinted as the sign-in call to action"
              onClick={() => { onClose(); openAuthModal('/', null, 'signin') }}
              className={cn(itemClass, 'bg-[var(--color-brand-primary-soft)] font-semibold text-[var(--color-brand-primary-ink)] hover:bg-[var(--color-brand-primary-soft)]/70')}
              role="menuitem"
            >
              <LogIn className="size-[18px] shrink-0" />
              <span className={localeInlineLabelClass(locale)}>{copy.menu.signIn}</span>
            </button>
          )}

          {user && isStaff ? (
            <>
              <Divider />
              <div className="flex items-center gap-2.5 bg-[var(--color-brand-primary-soft)] py-2 ps-3 pe-2.5">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-[7px] bg-[var(--color-brand-primary)] text-[var(--color-brand-on-primary)]"><ShieldCheck className="size-[13px]" aria-hidden /></span>
                <span className={cn('min-w-0 flex-1 text-[0.6875rem] leading-tight text-[var(--color-brand-primary-ink)]', locale === 'ar' && 'text-end')}>
                  <b className="block text-xs font-bold">{copy.page.staff}</b>
                  {copy.page.staffRole}
                </span>
                <Button size="touch" role="menuitem" onClick={() => { onClose(); navigate('/admin') }} className="rounded-full px-3 text-[0.6875rem] font-bold">{copy.page.openPortal}</Button>
              </div>
            </>
          ) : null}

          {user ? <ProPlanRow variant="menu" onNavigate={delayedClose} /> : null}

          <Divider />
          <div className="grid grid-cols-3 gap-1.5 p-2.5">
            {link('/goals', Target, t.nav.goals)}
            {link('/paydays', CalendarClock, t.nav.income)}
            {link('/subscriptions', RotateCwClock, t.nav.subscriptions)}
            {link('/reports', BarChart3, t.nav.reports)}
            {link('/settings', Settings, copy.menu.openSettings)}
          </div>
        </div>
      ) : null}
    </>
  )
}
