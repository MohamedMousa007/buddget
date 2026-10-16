'use client'


import { usePathname } from 'next/navigation'
import { useMemo, useRef, useState } from 'react'
import { User } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useAuth } from '@/components/auth/AuthProvider'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { resolveProfileAvatarSrc } from '@/lib/profile/avatarDisplay'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n'
import { isSupabaseConfigured } from '@/lib/supabase/env'
import { ProfileDropdown } from '@/components/layout/ProfileDropdown'
import { NotificationInbox } from '@/components/notifications/NotificationInbox'
import { isNative } from '@/lib/native/isNative'
import { IconButton } from '@/components/ui/IconButton'
import { Button } from '@/components/ui/button'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { useSetupProgress } from '@/hooks/useSetupProgress'

/** The avatar that opens ProfileDropdown — the mobile header's, and Flow's own header's. */
export function ProfileAvatarWithMenu({ className }: { className?: string }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const { user } = useAuth()
  const configured = useMemo(() => isSupabaseConfigured(), [])
  const profile = useFinanceStore(useShallow((s) => s.profile))
  const src =
    configured && !user ? null : resolveProfileAvatarSrc(profile)
  const { pct } = useSetupProgress()
  const setupActive = pct < 100

  return (
    <div ref={containerRef} className="relative">
      <span
        className="relative inline-flex size-11 items-center justify-center rounded-full"
      >
        <ProgressRing
          pct={pct}
          size={44}
          stroke={3}
          track="var(--color-brand-border-strong)"
          arc="var(--color-brand-primary)"
          className="pointer-events-none absolute inset-0"
        />
        <IconButton
          onClick={() => setOpen((v) => !v)}
          variant="tinted"
          size="sm"
          shape="round"
          className={cn(
            'size-9 overflow-hidden hover:ring-2 hover:ring-[var(--color-brand-primary)]/40',
            'border-transparent',
            className
          )}
          aria-label={t.nav.profileMenu}
          aria-expanded={open}
          aria-haspopup="menu"
        >
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt="" className="w-full h-full object-cover" width={36} height={36} />
          ) : (
            <User className="w-5 h-5 text-[var(--color-brand-text-secondary)]" />
          )}
        </IconButton>
        {setupActive ? (
          <span
            aria-hidden
            className="pointer-events-none absolute -bottom-1 -end-1.5 rounded-full bg-[var(--color-brand-primary)] px-1 text-[9px] font-bold leading-[14px] text-[var(--color-brand-bg)] font-mono-numbers"
          >
            {pct}%
          </span>
        ) : null}
      </span>
      <ProfileDropdown open={open} onClose={() => setOpen(false)} containerRef={containerRef} />
    </div>
  )
}

type AuthNavLayout = 'desktop' | 'mobile'

/**
 * Desktop (`layout="desktop"`): auth buttons + profile avatar with dropdown.
 * Mobile toolbar (`layout="mobile"`): profile avatar with dropdown only.
 */
export function AuthNavButtons({
  className,
  layout = 'desktop',
}: {
  className?: string
  layout?: AuthNavLayout
}) {
  const pathname = usePathname()
  const t = useT()
  const { user, loading, openAuthModal } = useAuth()

  const configured = useMemo(() => isSupabaseConfigured(), [])

  const nextPath = pathname || '/'

  if (!configured) {
    if (layout === 'mobile') {
      return (
        <div className={cn('flex flex-nowrap items-center justify-end gap-1', className)}>
          <ProfileAvatarWithMenu />
        </div>
      )
    }
    return (
      <div className={cn('flex flex-nowrap items-center gap-1.5 sm:gap-2', className)}>
        <ProfileAvatarWithMenu />
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
    // Redesign: no notification bell on the mobile header — avatar only.
    return (
      <div className={cn('flex flex-nowrap items-center justify-end gap-1', className)}>
        <ProfileAvatarWithMenu />
      </div>
    )
  }

  return (
    <div className={cn('flex flex-nowrap items-center gap-1.5 sm:gap-2', className)}>
      {!user ? (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={() => openAuthModal(nextPath, null, 'signin')}
            className="text-xs font-semibold sm:px-3"
          >
            {t.common.signIn}
          </Button>
          <Button
            size="sm"
            onClick={() => openAuthModal(nextPath, null, 'signup')}
            className="text-xs font-semibold sm:px-3"
          >
            {t.common.signUp}
          </Button>
        </>
      ) : !isNative() ? (
        <NotificationInbox />
      ) : null}
      <ProfileAvatarWithMenu />
    </div>
  )
}
