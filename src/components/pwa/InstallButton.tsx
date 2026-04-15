'use client'

import { useState, useCallback, useSyncExternalStore } from 'react'
import { Download, X } from 'lucide-react'
import { usePWAInstall } from '@/hooks/usePWAInstall'
import { IosInstallDialog } from '@/components/pwa/IosInstallDialog'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n'

const BANNER_DISMISS_KEY = 'buddget-pwa-install-banner-dismissed-at'
const BANNER_STORE_EVENT = 'buddget-pwa-banner-dismiss'
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000

function isBannerDismissed(): boolean {
  if (typeof window === 'undefined') return false
  const raw = localStorage.getItem(BANNER_DISMISS_KEY)
  if (!raw) return false
  const t = Number.parseInt(raw, 10)
  if (Number.isNaN(t)) return false
  return Date.now() - t < DISMISS_MS
}

function subscribeBannerDismissed(onStoreChange: () => void) {
  if (typeof window === 'undefined') return () => {}
  const onStorage = (e: StorageEvent) => {
    if (e.key === BANNER_DISMISS_KEY || e.key === null) onStoreChange()
  }
  const onLocal = () => onStoreChange()
  window.addEventListener('storage', onStorage)
  window.addEventListener(BANNER_STORE_EVENT, onLocal)
  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener(BANNER_STORE_EVENT, onLocal)
  }
}

function dismissBanner() {
  if (typeof window === 'undefined') return
  localStorage.setItem(BANNER_DISMISS_KEY, String(Date.now()))
  window.dispatchEvent(new Event(BANNER_STORE_EVENT))
}

export type InstallButtonVariant = 'button' | 'banner' | 'menu-item'

export interface InstallButtonProps {
  variant: InstallButtonVariant
  className?: string
}

export function InstallButton({ variant, className }: InstallButtonProps) {
  const { platform, canInstall, isInstalled, triggerInstall } = usePWAInstall()
  const t = useT()
  const [iosOpen, setIosOpen] = useState(false)
  const bannerDismissed = useSyncExternalStore(
    subscribeBannerDismissed,
    () => isBannerDismissed(),
    () => false
  )

  const openFlow = useCallback(async () => {
    if (platform === 'ios') {
      setIosOpen(true)
      return
    }
    await triggerInstall()
  }, [platform, triggerInstall])

  const handleDismissBanner = () => {
    dismissBanner()
  }

  if (isInstalled) return null

  if (variant === 'banner') {
    /** iOS Safari never fires `beforeinstallprompt`; still show the banner with Add to Home Screen steps. */
    if (bannerDismissed || (!canInstall && platform !== 'ios')) return null
    return (
      <>
        <div
          className={cn(
            'lg:hidden fixed start-2 end-2 z-[48] rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)]/95 backdrop-blur-xl shadow-lg px-3 py-2.5 flex items-center gap-2',
            'bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))]',
            className
          )}
        >
          <Download className="w-5 h-5 shrink-0 text-[var(--color-brand-red)]" aria-hidden />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-[var(--color-brand-text-primary)]">{t.pwa.installTitle}</p>
            <p className="text-[10px] text-[var(--color-brand-text-muted)] leading-snug">
              {t.pwa.installSubtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void openFlow()}
            className="shrink-0 px-3 py-1.5 rounded-lg bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white text-xs font-semibold"
          >
            {t.pwa.installButton}
          </button>
          <button
            type="button"
            onClick={handleDismissBanner}
            className="shrink-0 inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg text-[var(--color-brand-text-muted)] hover:bg-[var(--color-brand-elevated)]"
            aria-label="Dismiss install prompt"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <IosInstallDialog open={iosOpen} onOpenChange={setIosOpen} />
      </>
    )
  }

  if (variant === 'menu-item' || variant === 'button') {
    if (!canInstall && platform !== 'ios') return null
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void openFlow()}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold text-white bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] transition-colors w-full justify-center',
          className
        )}
      >
        <Download className="w-4 h-4" />
        {t.pwa.installApp}
      </button>
      <IosInstallDialog open={iosOpen} onOpenChange={setIosOpen} />
    </>
  )
}
