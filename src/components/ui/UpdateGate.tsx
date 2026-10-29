'use client'

import { useCallback, useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { apiFetch } from '@/lib/apiBase'
import { APP_CLIENT_VERSION, isVersionBelow } from '@/lib/appVersion'
import { clientPlatform, UPDATE_REQUIRED_EVENT } from '@/lib/clientInfo'
import { useLocale } from '@/lib/i18n'
import { UPDATE_GATE_COPY } from '@/lib/i18n/updateGateCopy'

interface AppConfig {
  min?: { ios?: string; android?: string }
  updateUrl?: { ios?: string; android?: string }
}

const RECHECK_MS = 5 * 60 * 1000

/**
 * Blocks the app with an update screen when this release is below the minimum set in the admin portal (or the server
 * says so with a 426). Native apps only: the web app is always the latest. Nothing is shown, and nothing is fetched
 * on the web.
 */
export function UpdateGate() {
  const { locale } = useLocale()
  const platform = clientPlatform()
  const [blocked, setBlocked] = useState(false)
  const [url, setUrl] = useState('')

  const check = useCallback(async () => {
    if (platform === 'web') return
    try {
      const res = await apiFetch('/api/app-config')
      if (!res.ok) return
      const cfg = (await res.json()) as AppConfig
      setUrl(cfg.updateUrl?.[platform] ?? '')
      setBlocked(isVersionBelow(APP_CLIENT_VERSION, cfg.min?.[platform]))
    } catch {
      /* offline: the gate decides again when the app is online */
    }
  }, [platform])

  useEffect(() => {
    if (platform === 'web') return
    const first = setTimeout(() => void check(), 0)
    const onRequired = () => {
      setBlocked(true)
      void check()
    }
    let last = Date.now()
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - last > RECHECK_MS) {
        last = Date.now()
        void check()
      }
    }
    window.addEventListener(UPDATE_REQUIRED_EVENT, onRequired)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearTimeout(first)
      window.removeEventListener(UPDATE_REQUIRED_EVENT, onRequired)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [platform, check])

  if (!blocked) return null
  const copy = UPDATE_GATE_COPY[locale]
  return (
    <div data-inert-exempt role="alertdialog" aria-modal="true" aria-labelledby="update-gate-title" className="fixed inset-0 z-[var(--z-system)] flex items-center justify-center bg-[var(--color-brand-bg)] px-6 py-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <Card padding="lg" className="w-full max-w-sm text-center">
        <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary-ink)]">
          <Download className="size-6" aria-hidden />
        </span>
        <h1 id="update-gate-title" className="font-heading text-xl font-bold text-[var(--color-brand-text-primary)]">{copy.title}</h1>
        <p className="mt-2 text-sm text-[var(--color-brand-text-secondary)]">{copy.body}</p>
        {url ? (
          <Button size="cta-block" className="mt-6" onClick={() => window.location.assign(url)}>{copy.cta}</Button>
        ) : (
          <p className="mt-6 text-xs text-[var(--color-brand-text-muted)]">{copy.noLink}</p>
        )}
      </Card>
    </div>
  )
}
