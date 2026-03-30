'use client'

import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import {
  User,
  SlidersHorizontal,
  Settings,
  LogOut,
  LogIn,
  UserPlus,
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
  'flex items-center gap-3 px-4 py-2.5 text-sm text-[#A0A0B8] hover:text-white hover:bg-[#1A1A24] transition-colors duration-150 cursor-pointer w-full'

export function ProfileDropdown({ open, onClose, containerRef }: ProfileDropdownProps) {
  const router = useRouter()
  const pathname = usePathname()
  const t = useT()
  const { locale } = useLocale()
  const { user, signOut, openAuthModal } = useAuth()
  const profile = useFinanceStore(useShallow((s) => s.profile))
  const prevPathname = useRef(pathname)

  const configured = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
    return !!(url && key)
  }, [])

  const isGuest = configured && !user

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
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

  const navigate = (href: string) => {
    router.push(href)
    onClose()
  }

  const handleSignOut = async () => {
    clearBudgetData()
    await signOut()
    onClose()
    router.push('/')
  }

  if (isGuest) {
    return (
      <div
        className="absolute top-full end-0 mt-2 z-50 w-56 bg-[#111118] border border-[#2A2A38] rounded-2xl shadow-2xl overflow-hidden"
        role="menu"
      >
        <button
          type="button"
          onClick={() => {
            openAuthModal()
            onClose()
          }}
          className={cn(itemClass, 'rounded-t-2xl')}
          role="menuitem"
        >
          <LogIn className="w-4 h-4 shrink-0" />
          <span className={localeInlineLabelClass(locale)}>{t.common.signIn}</span>
        </button>
        <button
          type="button"
          onClick={() => {
            openAuthModal()
            onClose()
          }}
          className={cn(itemClass, 'rounded-b-2xl')}
          role="menuitem"
        >
          <UserPlus className="w-4 h-4 shrink-0" />
          <span className={localeInlineLabelClass(locale)}>{t.common.signUp}</span>
        </button>
      </div>
    )
  }

  return (
    <div
      className="absolute top-full end-0 mt-2 z-50 w-56 bg-[#111118] border border-[#2A2A38] rounded-2xl shadow-2xl overflow-hidden"
      role="menu"
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="w-10 h-10 rounded-full overflow-hidden border border-[#2A2A38] bg-[var(--color-brand-elevated)] flex items-center justify-center shrink-0">
          {avatarSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarSrc} alt="" className="w-full h-full object-cover" width={40} height={40} />
          ) : (
            <User className="w-5 h-5 text-[var(--color-brand-text-secondary)]" />
          )}
        </div>
        <div className={cn('min-w-0', locale === 'ar' && 'text-end')}>
          <p className="text-sm font-medium text-white truncate">{displayName}</p>
          {displayEmail ? (
            <p className="text-xs text-[#A0A0B8] truncate">{displayEmail}</p>
          ) : null}
        </div>
      </div>

      <div className="border-t border-[#2A2A38]" />

      <button type="button" onClick={() => navigate('/profile')} className={itemClass} role="menuitem">
        <User className="w-4 h-4 shrink-0" />
        <span className={localeInlineLabelClass(locale)}>{t.profileDropdown.yourProfile}</span>
      </button>
      <button type="button" onClick={() => navigate('/#budget')} className={itemClass} role="menuitem">
        <SlidersHorizontal className="w-4 h-4 shrink-0" />
        <span className={localeInlineLabelClass(locale)}>{t.profileDropdown.budgetSetup}</span>
      </button>
      <button type="button" onClick={() => navigate('/settings')} className={itemClass} role="menuitem">
        <Settings className="w-4 h-4 shrink-0" />
        <span className={localeInlineLabelClass(locale)}>{t.profileDropdown.settings}</span>
      </button>

      {configured ? (
        <>
          <div className="border-t border-[#2A2A38]" />
          <button
            type="button"
            onClick={handleSignOut}
            className={cn(itemClass, 'text-[#E50914] hover:text-[#E50914]')}
            role="menuitem"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span className={localeInlineLabelClass(locale)}>{t.common.signOut}</span>
          </button>
        </>
      ) : null}
    </div>
  )
}
