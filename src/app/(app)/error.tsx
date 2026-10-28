'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { captureAppError } from '@/lib/crash/init'

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [reportId, setReportId] = useState<string | undefined>()

  useEffect(() => {
    console.error(error)
    setReportId(captureAppError(error, 'route'))
  }, [error])

  return (
    <div className="min-h-[50vh] flex items-center justify-center p-6">
      <div className="text-center max-w-md space-y-4">
        <h2 className="text-lg font-bold text-[var(--color-brand-text-primary)]">Something went wrong</h2>
        <p className="text-sm text-[var(--color-brand-text-muted)]">{error.message}</p>
        {reportId ? (
          <p className="font-mono-numbers text-xs text-[var(--color-brand-text-muted)]">Report {reportId.slice(0, 8)}</p>
        ) : null}
        <Button size="touch" onClick={reset}>
          Try again
        </Button>
      </div>
    </div>
  )
}
