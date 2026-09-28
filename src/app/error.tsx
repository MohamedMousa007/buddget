'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-[50vh] flex items-center justify-center p-6">
      <div className="text-center max-w-md space-y-4">
        <h2 className="text-lg font-bold text-[var(--color-brand-text-primary)]">Something went wrong</h2>
        <p className="text-sm text-[var(--color-brand-text-muted)]">{error.message}</p>
        <button
          type="button"
          onClick={reset}
          className="px-4 py-2 rounded-xl bg-[var(--color-brand-primary)] hover:bg-[var(--color-brand-primary-hover)] text-[var(--color-brand-on-primary)] text-sm font-medium transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
