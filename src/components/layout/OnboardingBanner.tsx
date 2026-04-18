'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowRight } from 'lucide-react'
import { useAuth } from '@/components/auth/AuthProvider'
import { useFirstRunChecklist } from '@/lib/onboarding/firstRunChecklist'
import { useT } from '@/lib/i18n'

/**
 * Slim one-line banner shown on every main-app page except the dashboard
 * (the dashboard has its own checklist card) and `/onboarding` itself. Feeds
 * off the same `useFirstRunChecklist` snapshot as the dashboard so counts
 * never drift. Tap → navigate to the dashboard where the full checklist
 * lives. Hidden once `allDone` or the user opted out via "Not now".
 */
export function OnboardingBanner() {
  const pathname = usePathname()
  const t = useT()
  const { user, loading } = useAuth()
  const checklist = useFirstRunChecklist()

  if (loading || !user) return null
  if (checklist.allDone || checklist.hidden) return null
  // Dashboard surfaces the full card; also skip the onboarding + profile routes.
  if (!pathname) return null
  if (pathname === '/') return null
  if (pathname.startsWith('/onboarding')) return null
  if (pathname.startsWith('/profile')) return null

  const pct = Math.round((checklist.doneCount / checklist.totalCount) * 100)

  return (
    <Link
      href="/"
      className="block px-4 py-1.5 border-b border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]/60 hover:bg-[var(--color-brand-elevated)] transition-colors"
    >
      <div className="max-w-3xl mx-auto flex items-center gap-3">
        <span className="text-xs font-medium text-[var(--color-brand-text-primary)] shrink-0">
          {t.onboarding.checklistTitle}
        </span>
        <div className="flex-1 min-w-0 h-1 rounded-full bg-[var(--color-brand-border)] overflow-hidden">
          <div
            className="h-full rounded-full bg-[var(--color-brand-red)] transition-[width] duration-300 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-[11px] tabular-nums text-[var(--color-brand-text-muted)] shrink-0">
          {t.onboarding.checklistProgress(checklist.doneCount, checklist.totalCount)}
        </span>
        <ArrowRight className="w-3.5 h-3.5 text-[var(--color-brand-text-muted)] rtl:rotate-180 shrink-0" aria-hidden />
      </div>
    </Link>
  )
}
