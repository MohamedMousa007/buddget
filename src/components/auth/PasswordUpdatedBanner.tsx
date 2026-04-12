'use client'

import { useEffect, useRef, Suspense } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { CheckCircle2, X } from 'lucide-react'
import { useT } from '@/lib/i18n'

/**
 * After password reset, the app signs the user out and redirects with `?passwordUpdated=1`.
 * Shows a dismissible confirmation and strips the query param from the URL.
 */
function PasswordUpdatedBannerInner() {
  const t = useT()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const navRouter = useRouter()
  const cleared = useRef(false)

  const show = searchParams.get('passwordUpdated') === '1'

  useEffect(() => {
    if (!show) {
      cleared.current = false
      return
    }
    const tId = window.setTimeout(() => {
      if (cleared.current) return
      cleared.current = true
      const qs = new URLSearchParams(searchParams.toString())
      qs.delete('passwordUpdated')
      const q = qs.toString()
      navRouter.replace(q ? `${pathname}?${q}` : pathname)
    }, 8000)
    return () => window.clearTimeout(tId)
  }, [show, searchParams, pathname, navRouter])

  const dismiss = () => {
    if (cleared.current) return
    cleared.current = true
    const qs = new URLSearchParams(searchParams.toString())
    qs.delete('passwordUpdated')
    const q = qs.toString()
    navRouter.replace(q ? `${pathname}?${q}` : pathname)
  }

  if (!show) return null

  return (
    <div
      role="status"
      className="mx-4 mt-3 flex items-start gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100 shadow-lg shadow-emerald-500/5 backdrop-blur-md lg:mx-8"
    >
      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" aria-hidden />
      <p className="min-w-0 flex-1 leading-snug">{t.resetPassword.successSignInPrompt}</p>
      <button
        type="button"
        onClick={dismiss}
        className="shrink-0 rounded-lg p-1 text-emerald-200/80 transition-colors hover:bg-[var(--color-brand-text-primary)]/10 hover:text-[var(--color-brand-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  )
}

export function PasswordUpdatedBanner() {
  return (
    <Suspense fallback={null}>
      <PasswordUpdatedBannerInner />
    </Suspense>
  )
}
