'use client'

import { useEffect } from 'react'
import { CheckCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useT } from '@/lib/i18n'

/**
 * Brief success screen shown after onboarding completes.
 * Auto-redirects to dashboard after 1.5s.
 */
export function OnboardingComplete() {
  const t = useT()
  const router = useRouter()

  useEffect(() => {
    const timer = setTimeout(() => router.push('/'), 1500)
    return () => clearTimeout(timer)
  }, [router])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4 px-6">
      <div className="w-16 h-16 rounded-full bg-[var(--color-brand-red)]/10 flex items-center justify-center">
        <CheckCircle className="w-8 h-8 text-[var(--color-brand-red)]" />
      </div>
      <div>
        <h2 className="text-xl font-semibold text-[var(--color-brand-text-primary)]">
          {t.onboarding.completeTitle}
        </h2>
        <p className="text-sm text-[var(--color-brand-text-muted)] mt-1">
          {t.onboarding.completeSubtitle}
        </p>
      </div>
    </div>
  )
}
