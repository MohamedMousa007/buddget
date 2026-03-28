'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Download, X, ChevronRight } from 'lucide-react'
import { usePWAInstall } from '@/hooks/usePWAInstall'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

const BANNER_DISMISS_KEY = 'buddget-pwa-install-banner-dismissed-at'
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000

function isBannerDismissed(): boolean {
  if (typeof window === 'undefined') return false
  const raw = localStorage.getItem(BANNER_DISMISS_KEY)
  if (!raw) return false
  const t = Number.parseInt(raw, 10)
  if (Number.isNaN(t)) return false
  return Date.now() - t < DISMISS_MS
}

function dismissBanner() {
  localStorage.setItem(BANNER_DISMISS_KEY, String(Date.now()))
}

export type InstallButtonVariant = 'button' | 'banner' | 'menu-item'

export interface InstallButtonProps {
  variant: InstallButtonVariant
  className?: string
}

export function InstallButton({ variant, className }: InstallButtonProps) {
  const { platform, canInstall, isInstalled, triggerInstall } = usePWAInstall()
  const [iosOpen, setIosOpen] = useState(false)
  const [bannerDismissed, setBannerDismissed] = useState(true)

  useEffect(() => {
    setBannerDismissed(isBannerDismissed())
  }, [])

  const openFlow = useCallback(async () => {
    if (platform === 'ios') {
      setIosOpen(true)
      return
    }
    await triggerInstall()
  }, [platform, triggerInstall])

  const handleDismissBanner = () => {
    dismissBanner()
    setBannerDismissed(true)
  }

  if (isInstalled) return null

  if (variant === 'banner') {
    if (bannerDismissed || !canInstall) return null
    return (
      <>
        <div
          className={cn(
            'lg:hidden fixed left-2 right-2 z-[48] rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)]/95 backdrop-blur-xl shadow-lg px-3 py-2.5 flex items-center gap-2',
            'bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))]',
            className
          )}
        >
          <Download className="w-5 h-5 shrink-0 text-[var(--color-brand-red)]" aria-hidden />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white">Install Buddget</p>
            <p className="text-[10px] text-[var(--color-brand-text-muted)] leading-snug">
              Add to your home screen for quick access.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void openFlow()}
            className="shrink-0 px-3 py-1.5 rounded-lg bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white text-xs font-semibold"
          >
            Install
          </button>
          <button
            type="button"
            onClick={handleDismissBanner}
            className="shrink-0 p-1.5 rounded-lg text-[var(--color-brand-text-muted)] hover:bg-[var(--color-brand-elevated)]"
            aria-label="Dismiss install prompt"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <IosInstallDialog open={iosOpen} onOpenChange={setIosOpen} />
      </>
    )
  }

  if (variant === 'menu-item') {
    if (!canInstall) {
      return (
        <Link
          href="/install"
          className={cn(
            'flex items-center justify-between w-full px-4 py-3 rounded-xl text-sm text-white border border-[var(--color-brand-border)] hover:bg-[var(--color-brand-elevated)] transition-colors',
            className
          )}
        >
          <span className="flex items-center gap-2">
            <Download className="w-4 h-4 text-[var(--color-brand-red)]" />
            Install Buddget app
          </span>
          <ChevronRight className="w-4 h-4 text-[var(--color-brand-text-muted)]" />
        </Link>
      )
    }
    return (
      <>
        <button
          type="button"
          onClick={() => void openFlow()}
          className={cn(
            'flex items-center justify-between w-full px-4 py-3 rounded-xl text-sm text-white border border-[var(--color-brand-border)] hover:bg-[var(--color-brand-elevated)] transition-colors text-left',
            className
          )}
        >
          <span className="flex items-center gap-2">
            <Download className="w-4 h-4 text-[var(--color-brand-red)]" />
            Install Buddget app
          </span>
          <ChevronRight className="w-4 h-4 text-[var(--color-brand-text-muted)]" />
        </button>
        <IosInstallDialog open={iosOpen} onOpenChange={setIosOpen} />
      </>
    )
  }

  /* variant === 'button' */
  if (!canInstall) {
    return (
      <Link
        href="/install"
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-white border border-[var(--color-brand-border)] hover:bg-[var(--color-brand-elevated)] transition-colors w-full justify-center',
          className
        )}
      >
        <Download className="w-4 h-4 text-[var(--color-brand-red)]" />
        Install app
      </Link>
    )
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
        Install app
      </button>
      <IosInstallDialog open={iosOpen} onOpenChange={setIosOpen} />
    </>
  )
}

function IosInstallDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const steps = [
    { n: 1, text: 'Open this site in Safari (if you are not already).' },
    { n: 2, text: 'Tap the Share button at the bottom of the screen.' },
    { n: 3, text: 'Scroll and tap Add to Home Screen.' },
    { n: 4, text: 'Tap Add in the top right.' },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md bg-[var(--color-brand-card)] border-[var(--color-brand-border)] text-white ring-white/10"
        showCloseButton
      >
        <DialogHeader>
          <DialogTitle className="text-white">Install on iPhone</DialogTitle>
          <DialogDescription className="text-[var(--color-brand-text-muted)]">
            Follow these steps to add Buddget to your home screen.
          </DialogDescription>
        </DialogHeader>
        <ol className="space-y-3 mt-2">
          {steps.map((s) => (
            <li
              key={s.n}
              className="flex gap-3 text-sm text-[var(--color-brand-text-secondary)]"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--color-brand-elevated)] text-xs font-bold text-[var(--color-brand-red)]">
                {s.n}
              </span>
              <span className="pt-0.5 leading-snug">{s.text}</span>
            </li>
          ))}
        </ol>
      </DialogContent>
    </Dialog>
  )
}
