'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useMemo } from 'react'
import { User } from 'lucide-react'
import { useAuth } from '@/components/auth/AuthProvider'
import { cn } from '@/lib/utils'

const btnClass =
  'inline-flex items-center justify-center px-2 py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold transition-colors border border-[var(--color-brand-border)] text-white hover:bg-[var(--color-brand-elevated)] sm:px-3'

/**
 * Logged out: Log in + Sign up (open auth modal) and Settings.
 * Logged in: Settings shortcut (profile).
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
      <Link
        href="/settings"
        className={cn(
          'p-2 rounded-lg hover:bg-[var(--color-brand-elevated)] transition-colors',
          className
        )}
        aria-label="Settings"
      >
        <User className="w-5 h-5 text-[var(--color-brand-text-secondary)]" />
      </Link>
    )
  }

  if (loading) {
    return (
      <div
        className={cn('h-9 w-24 rounded-lg bg-[var(--color-brand-elevated)]/80 animate-pulse', className)}
        aria-hidden
      />
    )
  }

  if (user) {
    return (
      <Link
        href="/settings"
        className={cn(
          'p-2 rounded-lg hover:bg-[var(--color-brand-elevated)] transition-colors',
          className
        )}
        aria-label="Settings"
      >
        <User className="w-5 h-5 text-[var(--color-brand-text-secondary)]" />
      </Link>
    )
  }

  const nextPath = pathname || '/'

  return (
    <div className={cn('flex items-center gap-1.5 sm:gap-2', className)}>
      <button
        type="button"
        onClick={() => openAuthModal(nextPath)}
        className={btnClass}
      >
        Log in
      </button>
      <button
        type="button"
        onClick={() => openAuthModal(nextPath)}
        className="inline-flex items-center justify-center px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white transition-colors sm:px-3"
      >
        Sign up
      </button>
      <Link
        href="/settings"
        className="p-2 rounded-lg hover:bg-[var(--color-brand-elevated)] transition-colors"
        aria-label="Settings"
      >
        <User className="w-5 h-5 text-[var(--color-brand-text-secondary)]" />
      </Link>
    </div>
  )
}
