'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useMemo } from 'react'
import { User, Settings, Bell } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useShallow } from 'zustand/react/shallow'
import { useAuth } from '@/components/auth/AuthProvider'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { resolveProfileAvatarSrc } from '@/lib/profile/avatarDisplay'
import { cn } from '@/lib/utils'

const btnClass =
  'inline-flex items-center justify-center px-2 py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold transition-colors border border-[var(--color-brand-border)] text-white hover:bg-[var(--color-brand-elevated)] sm:px-3'

function HeaderNotificationsButton() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        type="button"
        className="inline-flex p-2 rounded-lg hover:bg-[var(--color-brand-elevated)] transition-colors shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-red)]/50"
        aria-label="Open notifications"
      >
        <Bell className="w-5 h-5 text-[var(--color-brand-text-secondary)]" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        side="bottom"
        sideOffset={8}
        className="w-[min(calc(100vw-2rem),20rem)] bg-[var(--color-brand-card)] border border-[var(--color-brand-border)] p-0 shadow-xl ring-1 ring-white/10 z-[100]"
      >
        <div className="p-3 border-b border-[var(--color-brand-border)]">
          <DropdownMenuLabel className="p-0 text-sm font-semibold text-white">Notifications</DropdownMenuLabel>
        </div>
        <p className="px-3 py-3 text-xs text-[var(--color-brand-text-muted)] leading-relaxed">
          No alerts right now. Budget reminders and spending insights will show up here in a future update.
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ProfileAvatarLink({ className }: { className?: string }) {
  const profile = useFinanceStore(useShallow((s) => s.profile))
  const src = resolveProfileAvatarSrc(profile)

  return (
    <Link
      href="/profile"
      className={cn(
        'rounded-full overflow-hidden border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] flex items-center justify-center shrink-0 w-9 h-9 hover:ring-2 hover:ring-[var(--color-brand-red)]/40 transition-all',
        className
      )}
      aria-label="Profile"
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote Dicebear + user data URLs
        <img src={src} alt="" className="w-full h-full object-cover" width={36} height={36} />
      ) : (
        <User className="w-5 h-5 text-[var(--color-brand-text-secondary)]" />
      )}
    </Link>
  )
}

/**
 * Profile (photo when set) + Settings. Logged out: Log in / Sign up + same icons.
 */
export function AuthNavButtons({ className }: { className?: string }) {
  const pathname = usePathname()
  const { user, loading, openAuthModal } = useAuth()

  const configured = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
    return !!(url && key)
  }, [])

  if (!configured) {
    return (
      <div className={cn('flex flex-nowrap items-center gap-1.5 sm:gap-2', className)}>
        <HeaderNotificationsButton />
        <ProfileAvatarLink />
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

  const nextPath = pathname || '/'

  return (
    <div className={cn('flex flex-nowrap items-center gap-1.5 sm:gap-2', className)}>
      <HeaderNotificationsButton />
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
      <ProfileAvatarLink />
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
