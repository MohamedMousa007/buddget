'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowRight } from 'lucide-react'
import { useAuth } from '@/components/auth/AuthProvider'
import { useT } from '@/lib/i18n'

/**
 * Persistent CTA while `onboarding_completed` is false.
 * Shown on all main-app routes until the user completes onboarding.
 */
export function OnboardingBanner() {
  const pathname = usePathname()
  const t = useT()
  const { user, loading } = useAuth()

  if (loading || !user) return null
  if (user.user_metadata?.onboarding_completed === true) return null
  if (!pathname) return null
  if (pathname.startsWith('/onboarding')) return null

  return (
    <Link
      href="/onboarding"
      className="block px-4 py-1.5 border-b border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]/60 hover:bg-[var(--color-brand-elevated)] transition-colors"
    >
      <div className="max-w-3xl mx-auto flex items-center gap-3">
        <span className="text-xs font-medium text-[var(--color-brand-text-primary)] shrink-0">
          {t.onboarding.bannerTagline}
        </span>
        <div className="flex-1 min-w-0" />
        <span className="text-xs text-[var(--color-brand-text-muted)] shrink-0">
          {t.onboarding.bannerCta}
        </span>
        <ArrowRight className="w-3.5 h-3.5 text-[var(--color-brand-text-muted)] rtl:rotate-180 shrink-0" aria-hidden />
      </div>
    </Link>
  )
}
