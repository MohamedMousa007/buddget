'use client'

import { useEffect, useRef, useCallback, type RefObject } from 'react'
import { AppLink as Link } from '@/components/ui/AppLink'
import { useNavPath } from '@/lib/navigation/navStore'
import { User, Settings, LogOut } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useAuth } from '@/components/auth/AuthProvider'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { resolveProfileAvatarSrc } from '@/lib/profile/avatarDisplay'
import { cn } from '@/lib/utils'
import { localeInlineLabelClass, useLocale, useT } from '@/lib/i18n'

interface ProfileDropdownProps {
  open: boolean
  onClose: () => void
  /** Ref covering the toggle button + dropdown for outside-click detection */
  containerRef: RefObject<HTMLDivElement | null>
}

const itemClass =
  'flex items-center gap-3 px-4 py-3 text-sm font-medium text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)] transition-colors duration-150 cursor-pointer w-full text-start'

export function ProfileDropdown({ open, onClose, containerRef }: ProfileDropdownProps) {
  const pathname = useNavPath()
  const t = useT()
  const { locale } = useLocale()
  const { user, signOut } = useAuth()
  const profile = useFinanceStore(useShallow((s) => s.profile))
  const prevPathname = useRef(pathname)

  useEffect(() => {
    if (!open) return
    // Use 'click' (not 'pointerdown') so the outside-click handler fires AFTER
    // any menu-item onClick has already committed — prevents unmounting the
    // dropdown before navigation fires on Android WebView.
    const handler = (e: MouseEvent) => {
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
      if (e.key === 'Escape') onClose()
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

  if (!open) return null

  const avatarSrc = resolveProfileAvatarSrc(profile)
  const displayName = profile.name || t.common.user
  const displayEmail = user?.email || profile.email || ''

  return (
    <div
      className="absolute top-full end-0 mt-2 z-50 w-64 bg-[var(--color-brand-card)] border border-[var(--color-brand-border)] rounded-2xl shadow-[0_24px_50px_-16px_rgba(0,0,0,0.7)] overflow-hidden"
      role="menu"
    >
      <div className="flex items-center gap-3 px-4 py-3.5">
        <div className="w-11 h-11 rounded-full overflow-hidden border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] flex items-center justify-center shrink-0">
          {avatarSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarSrc} alt="" className="w-full h-full object-cover" width={44} height={44} />
          ) : (
            <User className="w-5 h-5 text-[var(--color-brand-text-secondary)]" />
          )}
        </div>
        <div className={cn('min-w-0', locale === 'ar' && 'text-end')}>
          <p className="text-sm font-bold text-[var(--color-brand-text-primary)] truncate">{displayName}</p>
          {displayEmail ? (
            <p className="text-xs text-[var(--color-brand-text-muted)] truncate">{displayEmail}</p>
          ) : null}
        </div>
      </div>

      <div className="border-t border-[var(--color-brand-border)]" />

      <Link href="/settings/profile" onClick={delayedClose} className={itemClass} role="menuitem">
        <User className="w-4 h-4 shrink-0" />
        <span className={localeInlineLabelClass(locale)}>{t.profile.editProfile}</span>
      </Link>
      <Link href="/settings/" onClick={delayedClose} className={itemClass} role="menuitem">
        <Settings className="w-4 h-4 shrink-0" />
        <span className={localeInlineLabelClass(locale)}>{t.profileDropdown.settings}</span>
      </Link>

      <div className="border-t border-[var(--color-brand-border)]" />
      <button
        type="button"
        onClick={handleSignOut}
        className={cn(itemClass, 'font-semibold text-[var(--color-brand-red)] hover:text-[var(--color-brand-red)]')}
        role="menuitem"
      >
        <LogOut className="w-4 h-4 shrink-0" />
        <span className={localeInlineLabelClass(locale)}>{t.common.signOut}</span>
      </button>
    </div>
  )
}
