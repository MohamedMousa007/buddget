'use client'

import { CheckCircle2 } from 'lucide-react'
import { useT } from '@/lib/i18n'

export function AccountDeletedScreen() {
  const t = useT()

  const handleHome = () => {
    if (typeof window !== 'undefined') {
      window.location.assign('/')
    }
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[var(--color-brand-bg)] px-6 text-center"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)', paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/15 mb-6">
        <CheckCircle2 className="h-8 w-8 text-green-500" aria-hidden />
      </div>
      <h1 className="text-xl font-bold text-[var(--color-brand-text-primary)] mb-3 leading-snug max-w-xs">
        {t.profile.deleteAccountSuccessTitle}
      </h1>
      <p className="text-sm text-[var(--color-brand-text-secondary)] leading-relaxed max-w-sm mb-8">
        {t.profile.deleteAccountSuccessBody}
      </p>
      <button
        type="button"
        onClick={handleHome}
        className="h-12 px-8 rounded-2xl bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white text-sm font-semibold transition-colors"
      >
        {t.profile.deleteAccountSuccessButton}
      </button>
    </div>
  )
}
