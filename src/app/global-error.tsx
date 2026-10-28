'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { captureAppError } from '@/lib/crash/init'
import { en } from '@/lib/i18n/dictionaries/en'
import { ar } from '@/lib/i18n/dictionaries/ar'
import { readStoredLocale } from '@/lib/i18n/readStoredLocale'
import type { Locale } from '@/lib/i18n/types'

/** Shown when the root layout itself fails, so it carries its own html and body. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [reportId, setReportId] = useState<string | undefined>()
  const [locale, setLocale] = useState<Locale>('en')
  const t = (locale === 'ar' ? ar : en).systemPages.rootError

  useEffect(() => {
    setLocale(readStoredLocale())
  }, [])

  useEffect(() => {
    console.error(error)
    setReportId(captureAppError(error, 'root'))
  }, [error])

  return (
    <html lang={locale} dir="ltr" data-locale={locale}>
      <body className="font-sans antialiased bg-[var(--color-brand-bg,#fff)]">
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="text-center max-w-md space-y-4">
            <h2 className="text-lg font-bold text-[var(--color-brand-text-primary)]">{t.title}</h2>
            <p className="text-sm text-[var(--color-brand-text-muted)]">{t.body}</p>
            {reportId ? (
              <p className="font-mono-numbers text-xs text-[var(--color-brand-text-muted)]">{t.report(reportId.slice(0, 8))}</p>
            ) : null}
            <Button size="touch" onClick={reset}>
              {t.retry}
            </Button>
          </div>
        </div>
      </body>
    </html>
  )
}
