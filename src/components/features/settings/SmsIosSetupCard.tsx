'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'
import { useT } from '@/lib/i18n'

interface Props {
  downloadUrl: string | null
  onFetchToken: () => Promise<void>
}

/**
 * Card shown inside SettingsSmsTrackingSection for iOS Shortcut setup.
 * Guides the user through the one-time Shortcuts import flow.
 */
export function SmsIosSetupCard({ downloadUrl, onFetchToken }: Props) {
  const t = useT()
  const [fetching, setFetching] = useState(false)

  const handleDownload = async () => {
    if (!downloadUrl) {
      setFetching(true)
      try {
        await onFetchToken()
      } finally {
        setFetching(false)
      }
      return
    }
    window.open(downloadUrl, '_blank')
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-[var(--color-brand-text-muted)]">{t.smsTracking.iosCardSubtitle}</p>
      <ol className="space-y-1.5">
        {[
          t.smsTracking.iosCardStep1,
          t.smsTracking.iosCardStep2,
          t.smsTracking.iosCardStep3,
          t.smsTracking.iosCardStep4,
        ].map((step, i) => (
          <li key={i} className="text-xs text-[var(--color-brand-text-secondary)] flex gap-2">
            <span className="shrink-0 text-[var(--color-brand-text-muted)]">{i + 1}.</span>
            <span>{step.replace(/^\d+\. /, '')}</span>
          </li>
        ))}
      </ol>

      <button
        type="button"
        onClick={handleDownload}
        disabled={fetching}
        className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-brand-green)] px-4 py-2 text-xs font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        <Download className="h-3.5 w-3.5" />
        {fetching ? t.smsTracking.iosDownloading : t.smsTracking.iosDownloadButton}
      </button>
    </div>
  )
}
