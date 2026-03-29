'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useMemo, useRef, useState } from 'react'
import { User, Settings, Bell } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useAuth } from '@/components/auth/AuthProvider'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { resolveProfileAvatarSrc } from '@/lib/profile/avatarDisplay'
import { cn } from '@/lib/utils'
import { useNotifications } from '@/lib/notifications/useNotifications'
import { NotificationPanel } from '@/components/notifications/NotificationPanel'
import { ProfileDropdown } from '@/components/layout/ProfileDropdown'

const btnClass =
  'inline-flex items-center justify-center px-2 py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold transition-colors border border-[var(--color-brand-border)] text-white hover:bg-[var(--color-brand-elevated)] sm:px-3'

function NotificationBellWithPanel() {
  const { notifications, unreadCount, markAllRead } = useNotifications()
  const [open, setOpen] = useState(false)
  const bellRef = useRef<HTMLButtonElement>(null)

  const toggle = () => {
    setOpen((prev) => {
      if (!prev) markAllRead()
      return !prev
    })
  }

  return (
    <div className="relative shrink-0">
      <button
        ref={bellRef}
        type="button"
        onClick={toggle}
        className="relative inline-flex p-2 rounded-lg hover:bg-[var(--color-brand-elevated)] transition-colors shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-red)]/50"
        aria-label="Open notifications"
        aria-expanded={open}
      >
        <Bell className="w-5 h-5 text-[var(--color-brand-text-secondary)]" />
        {unreadCount > 0 ? (
          <span
            className="absolute top-0 right-0 h-2 w-2 rounded-full bg-[#E50914]"
            aria-hidden
          />
        ) : null}
      </button>
      <NotificationPanel
        open={open}
        onClose={() => setOpen(false)}
        notifications={notifications}
        anchorRef={bellRef}
      />
    </div>
  )
}

function ProfileAvatarWithMenu({ className }: { className?: string }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const profile = useFinanceStore(useShallow((s) => s.profile))
  const src = resolveProfileAvatarSrc(profile)

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'rounded-full overflow-hidden border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] flex items-center justify-center shrink-0 w-9 h-9 hover:ring-2 hover:ring-[var(--color-brand-red)]/40 transition-all cursor-pointer',
          className
        )}
        aria-label="Profile menu"
        aria-expanded={open}
        aria-haspopup="true"
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" className="w-full h-full object-cover" width={36} height={36} />
        ) : (
          <User className="w-5 h-5 text-[var(--color-brand-text-secondary)]" />
        )}
      </button>
      <ProfileDropdown open={open} onClose={() => setOpen(false)} containerRef={containerRef} />
    </div>
  )
}

type AuthNavLayout = 'desktop' | 'mobile'

/**
 * Desktop (`layout="desktop"`): full auth + settings + notifications.
 * Mobile toolbar (`layout="mobile"`): notifications + profile or compact sign-in only (no gear, no text buttons).
 */
export function AuthNavButtons({
  className,
  layout = 'desktop',
}: {
  className?: string
  layout?: AuthNavLayout
}) {
  const pathname = usePathname()
  const { user, loading, openAuthModal } = useAuth()

  const configured = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
    return !!(url && key)
  }, [])

  const nextPath = pathname || '/'

  if (!configured) {
    if (layout === 'mobile') {
      return (
        <div className={cn('flex flex-nowrap items-center justify-end gap-1', className)}>
          <NotificationBellWithPanel />
          <ProfileAvatarWithMenu />
        </div>
      )
    }
    return (
      <div className={cn('flex flex-nowrap items-center gap-1.5 sm:gap-2', className)}>
        <NotificationBellWithPanel />
        <ProfileAvatarWithMenu />
        <Link
          href="/settings"
          className="p-2 rounded-lg hover:bg-[var(--color-brand-elevated)] transition-colors"
          aria-label="Settings"
        >
          <Settings className="w-5 h-5 text-[var(--color-brand-text-secondary)]" />
        </Link>
      </div>
    )
  }

  if (loading) {
    return (
      <div
        className={cn('h-9 w-20 rounded-lg bg-[var(--color-brand-elevated)]/80 animate-pulse', className)}
        aria-hidden
      />
    )
  }

  if (layout === 'mobile') {
    return (
      <div className={cn('flex flex-nowrap items-center justify-end gap-1', className)}>
        <NotificationBellWithPanel />
        <ProfileAvatarWithMenu />
      </div>
    )
  }

  return (
    <div className={cn('flex flex-nowrap items-center gap-1.5 sm:gap-2', className)}>
      <NotificationBellWithPanel />
      {!user ? (
        <>
          <button type="button" onClick={() => openAuthModal(nextPath)} className={btnClass}>
            Log in
          </button>
          <button
            type="button"
            onClick={() => openAuthModal(nextPath)}
            className="inline-flex items-center justify-center px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white transition-colors sm:px-3"
          >
            Sign up
          </button>
        </>
      ) : null}
      <ProfileAvatarWithMenu />
      <Link
        href="/settings"
        className="p-2 rounded-lg hover:bg-[var(--color-brand-elevated)] transition-colors"
        aria-label="Settings"
      >
        <Settings className="w-5 h-5 text-[var(--color-brand-text-secondary)]" />
      </Link>
    </div>
  )
}
