'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

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
        <Button size="touch" onClick={reset}>
          Try again
        </Button>
      </div>
    </div>
  )
}
