'use client'

import { Button } from '@/components/ui/button'
import { useLocale, useT } from '@/lib/i18n'

export default function OfflinePage() {
  const t = useT().systemPages.offline
  const { locale } = useLocale()
  return (
    <div lang={locale} className="min-h-screen flex items-center justify-center p-6 bg-[var(--color-brand-bg)]">
      <div className="text-center max-w-sm space-y-4">
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-[var(--color-brand-text-primary)]">{t.title}</h1>
          <p className="text-sm text-[var(--color-brand-text-muted)]">{t.body}</p>
        </div>
        <Button size="touch" onClick={() => window.location.reload()}>
          {t.retry}
        </Button>
      </div>
    </div>
  )
}
