'use client'

import { useEffect, useRef, type RefObject } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import {
  User,
  Settings,
  LogOut,
  Target,
  RefreshCw,
  ListChecks,
} from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useAuth } from '@/components/auth/AuthProvider'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { resolveProfileAvatarSrc } from '@/lib/profile/avatarDisplay'
import { cn } from '@/lib/utils'
import { localeInlineLabelClass, useLocale, useT } from '@/lib/i18n'
import { clearBudgetData } from '@/lib/auth/clearBudgetData'

interface ProfileDropdownProps {
  open: boolean
  onClose: () => void
  /** Ref covering the toggle button + dropdown for outside-click detection */
  containerRef: RefObject<HTMLDivElement | null>
}

const itemClass =
  'flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--color-brand-text-secondary)] hover:text-[var(--color-brand-text-primary)] hover:bg-[var(--color-brand-elevated)] transition-colors duration-150 cursor-pointer w-full'

export function ProfileDropdown({ open, onClose, containerRef }: ProfileDropdownProps) {
  const router = useRouter()
  const pathname = usePathname()
  const t = useT()
  const { locale } = useLocale()
  const { user, signOut } = useAuth()
  const { profile, checklistHidden, updateSettings } = useFinanceStore(
    useShallow((s) => ({
      profile: s.profile,
      checklistHidden: s.settings.onboardingChecklistHidden,
      updateSettings: s.updateSettings,
    })),
  )
  const prevPathname = useRef(pathname)

  useEffect(() => {
    if (!open) return
    const handler = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('pointerdown', handler)
    return () => document.removeEventListener('pointerdown', handler)
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

  if (!open) return null

  const avatarSrc = resolveProfileAvatarSrc(profile)
  const displayName = profile.name || t.common.user
  const displayEmail = user?.email || profile.email || ''

  const handleSignOut = async () => {
    clearBudgetData()
    await signOut()
    onClose()
    router.push('/')
  }

  return (
    <div
      className="absolute top-full end-0 mt-2 z-50 w-56 bg-[var(--color-brand-card)] border border-[var(--color-brand-border)] rounded-2xl shadow-2xl overflow-hidden"
      role="menu"
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="w-10 h-10 rounded-full overflow-hidden border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] flex items-center justify-center shrink-0">
          {avatarSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarSrc} alt="" className="w-full h-full object-cover" width={40} height={40} />
          ) : (
            <User className="w-5 h-5 text-[var(--color-brand-text-secondary)]" />
          )}
        </div>
        <div className={cn('min-w-0', locale === 'ar' && 'text-end')}>
          <p className="text-sm font-medium text-[var(--color-brand-text-primary)] truncate">{displayName}</p>
          {displayEmail ? (
            <p className="text-xs text-[var(--color-brand-text-secondary)] truncate">{displayEmail}</p>
          ) : null}
        </div>
      </div>

      <div className="border-t border-[var(--color-brand-border)]" />

      <Link href="/profile" onClick={onClose} className={itemClass} role="menuitem">
        <User className="w-4 h-4 shrink-0" />
        <span className={localeInlineLabelClass(locale)}>{t.profileDropdown.yourProfile}</span>
      </Link>
      <Link href="/goals" onClick={onClose} className={itemClass} role="menuitem">
        <Target className="w-4 h-4 shrink-0" />
        <span className={localeInlineLabelClass(locale)}>{t.profileDropdown.goals}</span>
      </Link>
      <Link href="/subscriptions" onClick={onClose} className={itemClass} role="menuitem">
        <RefreshCw className="w-4 h-4 shrink-0" />
        <span className={localeInlineLabelClass(locale)}>{t.profileDropdown.subscriptions}</span>
      </Link>
      <Link href="/settings" onClick={onClose} className={itemClass} role="menuitem">
        <Settings className="w-4 h-4 shrink-0" />
        <span className={localeInlineLabelClass(locale)}>{t.profileDropdown.settings}</span>
      </Link>
      {checklistHidden ? (
        <Link
          href="/"
          onClick={() => {
            updateSettings({ onboardingChecklistHidden: false })
            onClose()
          }}
          className={itemClass}
          role="menuitem"
        >
          <ListChecks className="w-4 h-4 shrink-0" />
          <span className={localeInlineLabelClass(locale)}>{t.onboarding.checklistResumeCta}</span>
        </Link>
      ) : null}

      <div className="border-t border-[var(--color-brand-border)]" />
      <button
        type="button"
        onClick={handleSignOut}
        className={cn(itemClass, 'text-[var(--color-brand-red)] hover:text-[var(--color-brand-red)]')}
        role="menuitem"
      >
        <LogOut className="w-4 h-4 shrink-0" />
        <span className={localeInlineLabelClass(locale)}>{t.common.signOut}</span>
      </button>
    </div>
  )
}
