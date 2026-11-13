'use client'

import { useEffect, useRef, useCallback, useState, type ComponentType, type RefObject } from 'react'
import { AppLink as Link } from '@/components/ui/AppLink'
import { useNavPath } from '@/lib/navigation/navStore'
import {
  BarChart3, Bell, CalendarClock, CircleHelp, CreditCard, LogIn, LogOut, Settings, ShieldCheck, Target, User,
} from 'lucide-react'
import { RotateCwClock } from '@/components/ui/icons/RotateCwClock'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { QuickActions } from '@/components/features/settings/QuickActions'
import { Badge } from '@/components/ui/badge'
import { SetupChecklistSheet } from '@/components/features/setup/SetupProgressChip'
import { useSetupProgress } from '@/hooks/useSetupProgress'
import { useStaffAccess } from '@/hooks/useStaffAccess'
import { usePendingEntries } from '@/lib/alerts/usePending'
import { useShallow } from 'zustand/react/shallow'
import { useAuth } from '@/components/auth/AuthProvider'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
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
  const { user, signOut, openAuthModal } = useAuth()
  const profile = useFinanceStore(useShallow((s) => s.profile))
  const setActiveModal = useSettingsStore((s) => s.setActiveModal)
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

  const handleSignOut = async () => {
    // signOut owns all teardown and drops us to the landing gate. Don't
    // clearBudgetData() first (flips dataReady=false while authenticated → the
    // logout loading splash) and don't push('/') (signOut already navigates).
    await signOut()
    onClose()
  }

  if (!open && !setupOpen) return null

  const avatarSrc = resolveProfileAvatarSrc(profile)
  const displayName = profile.name || t.common.user
  const displayEmail = user?.email || profile.email || ''

  const link = (href: string, Icon: Glyph, label: string) => (
    <Link key={href} href={href} onClick={delayedClose} className={itemClass} role="menuitem">
      <Icon className="size-[18px] shrink-0" />
      <span className={localeInlineLabelClass(locale)}>{label}</span>
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
                <ProgressRing pct={pct} size={20} stroke={3} track="var(--color-brand-border-strong)" arc="var(--color-brand-primary)" />
                <span className={cn('flex-1', localeInlineLabelClass(locale))}>{t.setup.chipLabel} · <span className="font-mono-numbers">{pct}%</span></span>
              </button>
              <Divider />
            </>
          ) : null}
          {user ? (
            <Link
              href="/settings/profile"
              onClick={delayedClose}
              role="menuitem"
              className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-[var(--color-brand-elevated)]"
            >
              <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--color-brand-elevated)] ring-2 ring-[var(--color-brand-primary)]">
                {avatarSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarSrc} alt="" className="size-full object-cover" width={44} height={44} />
                ) : (
                  <User className="size-5 text-[var(--color-brand-text-secondary)]" />
                )}
              </span>
              <span className={cn('min-w-0 flex-1', locale === 'ar' && 'text-end')}>
                <span className="flex items-center gap-2">
                  <span className="truncate text-sm font-bold text-[var(--color-brand-text-primary)]">{displayName}</span>
                  {isStaff ? <Badge variant="brand" size="xs">{copy.menu.admin}</Badge> : null}
                </span>
                {displayEmail ? <span className="block truncate text-xs text-[var(--color-brand-text-muted)]">{displayEmail}</span> : null}
              </span>
            </Link>
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

          <QuickActions variant="menu" />
          <Divider />

          {link('/goals', Target, t.nav.goals)}
          {link('/paydays', CalendarClock, t.nav.paydays)}
          {link('/subscriptions', RotateCwClock, t.nav.subscriptions)}
          <button
            type="button"
            data-raw-button-ok="menu row sharing itemClass with the other profile menu items"
            onClick={() => { setActiveModal('paymentMethods'); onClose() }}
            className={itemClass}
            role="menuitem"
          >
            <CreditCard className="size-[18px] shrink-0" />
            <span className={localeInlineLabelClass(locale)}>{t.paymentMethods.title}</span>
          </button>
          {link('/reports', BarChart3, t.nav.reports)}
          <Link href="/notifications" onClick={delayedClose} className={itemClass} role="menuitem">
            <Bell className="size-[18px] shrink-0" />
            <span className={cn('flex-1', localeInlineLabelClass(locale))}>{t.notifications.title}</span>
            {pendingCount > 0 ? (
              <Badge tone="warn" size="xs" aria-label={t.notifications.needsYouCount(pendingCount)}>{pendingCount}</Badge>
            ) : null}
          </Link>
          <Divider />

          {link('/settings', Settings, copy.menu.openSettings)}
          {link('/settings/help', CircleHelp, copy.menu.helpFeedback)}
          {isStaff ? (
            <button
              type="button"
              data-raw-button-ok="menu row sharing itemClass with the other profile menu items"
              onClick={() => { onClose(); navigate('/admin') }}
              className={itemClass}
              role="menuitem"
            >
              <ShieldCheck className="size-[18px] shrink-0" />
              <span className={localeInlineLabelClass(locale)}>{copy.menu.adminPortal}</span>
            </button>
          ) : null}

          {user ? (
            <>
              <Divider />
              <button
                type="button"
                data-raw-button-ok="menu row sharing itemClass, tinted as the destructive sign-out"
                onClick={handleSignOut}
                className={cn(itemClass, 'font-semibold text-[var(--color-brand-red)] hover:text-[var(--color-brand-red)]')}
                role="menuitem"
              >
                <LogOut className="size-[18px] shrink-0" />
                <span className={localeInlineLabelClass(locale)}>{t.common.signOut}</span>
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </>
  )
}
