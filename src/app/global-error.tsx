'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { captureAppError } from '@/lib/crash/init'

/** Shown when the root layout itself fails, so it carries its own html and body. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [reportId, setReportId] = useState<string | undefined>()

  useEffect(() => {
    console.error(error)
    setReportId(captureAppError(error, 'root'))
  }, [error])

  return (
    <html lang="en">
      <body className="font-sans antialiased bg-[var(--color-brand-bg,#fff)]">
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="text-center max-w-md space-y-4">
            <h2 className="text-lg font-bold text-[var(--color-brand-text-primary)]">Buddget hit a problem</h2>
            <p className="text-sm text-[var(--color-brand-text-muted)]">Your data is safe. Try again, and if it keeps happening, quote the report number to support.</p>
            {reportId ? (
              <p className="font-mono-numbers text-xs text-[var(--color-brand-text-muted)]">Report {reportId.slice(0, 8)}</p>
            ) : null}
            <Button size="touch" onClick={reset}>
              Try again
            </Button>
          </div>
        </div>
      </body>
    </html>
  )
}
