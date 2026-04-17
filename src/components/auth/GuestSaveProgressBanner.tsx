'use client'

import { AlertTriangle } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/components/auth/auth-context'
import { useT } from '@/lib/i18n'

/**
 * Slim, non-dismissible banner shown above every page while a guest session
 * is active (and the guest has finished the 6-step onboarding — we suppress
 * it on `/guest-onboarding` to avoid stacking with the form card).
 *
 * CTA opens the auth modal in sign-up mode so the user can promote their
 * guest session into a real account. The existing SupabaseFinanceSync merge
 * path carries their in-memory state over on SIGNED_IN.
 */
export function GuestSaveProgressBanner() {
  const t = useT()
  const pathname = usePathname()
  const { openAuthModal, guestNickname } = useAuth()

  if (pathname === '/guest-onboarding') return null

  const hello = guestNickname ? t.guest.bannerHello(guestNickname) : t.guest.bannerHelloFallback

  return (
    <div
      role="status"
      className="flex items-start gap-3 px-4 py-2.5 text-sm border-b"
      style={{
        background: 'color-mix(in oklab, var(--color-brand-amber) 8%, transparent)',
        borderColor: 'color-mix(in oklab, var(--color-brand-amber) 24%, transparent)',
        color: 'var(--color-brand-text-primary)',
      }}
    >
      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-[var(--color-brand-amber)]" aria-hidden />
      <div className="flex-1 min-w-0 leading-snug">
        <span className="font-medium">{hello}</span>{' '}
        <span className="text-[var(--color-brand-text-secondary)]">{t.guest.saveProgressMessage}</span>
      </div>
      <button
        type="button"
        onClick={() => openAuthModal('/', null, 'signup')}
        className="shrink-0 inline-flex items-center h-8 px-3 rounded-lg text-xs font-semibold text-white bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] transition-colors"
      >
        {t.guest.saveProgressCta}
      </button>
    </div>
  )
}
