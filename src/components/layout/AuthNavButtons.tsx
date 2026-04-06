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
import { ProfileDropdown } from '@/components/layout/ProfileDropdown'
import { NotificationInbox } from '@/components/notifications/NotificationInbox'

const btnClass =
  'inline-flex items-center justify-center px-2 py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold transition-colors border border-[var(--color-brand-border)] text-white hover:bg-[var(--color-brand-elevated)] sm:px-3'

function ProfileAvatarWithMenu({ className }: { className?: string }) {
  const t = useT()
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
        aria-label={t.nav.profileMenu}
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
    return (
      <div className={cn('flex flex-nowrap items-center justify-end gap-1', className)}>
        {user ? <NotificationInbox /> : null}
        <ProfileAvatarWithMenu />
      </div>
    )
  }

  return (
    <div className={cn('flex flex-nowrap items-center gap-1.5 sm:gap-2', className)}>
      {!user ? (
        <>
          <button type="button" onClick={() => openAuthModal(nextPath)} className={btnClass}>
            {t.common.signIn}
          </button>
          <button
            type="button"
            onClick={() => openAuthModal(nextPath)}
            className="inline-flex items-center justify-center px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white transition-colors sm:px-3"
          >
            {t.common.signUp}
          </button>
        </>
      ) : (
        <NotificationInbox />
      )}
      <ProfileAvatarWithMenu />
    </div>
  )
}
