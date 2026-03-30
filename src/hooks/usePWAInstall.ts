'use client'

import { useEffect, useState, useRef, useCallback } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export type InstallPlatform = 'android' | 'ios' | 'desktop' | 'installed' | 'unsupported'

type PwaHintState = {
  platform: InstallPlatform
  canInstall: boolean
  isInstalled: boolean
}

function readInitialPwaHints(): PwaHintState {
  if (typeof window === 'undefined') {
    return { platform: 'unsupported', canInstall: false, isInstalled: false }
  }

  const installedModes = ['standalone', 'fullscreen', 'minimal-ui'] as const
  if (installedModes.some((mode) => window.matchMedia(`(display-mode: ${mode})`).matches)) {
    return { platform: 'installed', canInstall: false, isInstalled: true }
  }

  const ua = navigator.userAgent
  const isIOS = /iphone|ipad|ipod/i.test(ua)
  const isAndroid = /android/i.test(ua)
  const isSafari = /safari/i.test(ua) && !/chrome/i.test(ua)

  if (isIOS && isSafari) {
    return { platform: 'ios', canInstall: true, isInstalled: false }
  }

  let platform: InstallPlatform = 'unsupported'
  if (isAndroid) platform = 'android'
  else if (!isIOS) platform = 'desktop'

  return { platform, canInstall: false, isInstalled: false }
}

export function usePWAInstall() {
  const [{ platform, canInstall, isInstalled }, setState] = useState<PwaHintState>(() =>
    readInitialPwaHints()
  )
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- re-apply PWA hints on client; SSR initial state has no real matchMedia/UA */
    setState(readInitialPwaHints())
    /* eslint-enable react-hooks/set-state-in-effect */

    const handler = (e: Event) => {
      e.preventDefault()
      deferredPrompt.current = e as BeforeInstallPromptEvent
      setState((s) => ({ ...s, canInstall: true }))
    }
    const onInstalled = () => {
      deferredPrompt.current = null
      setState({
        platform: 'installed',
        canInstall: false,
        isInstalled: true,
      })
    }
    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const triggerInstall = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt.current) return false
    await deferredPrompt.current.prompt()
    const { outcome } = await deferredPrompt.current.userChoice
    deferredPrompt.current = null
    return outcome === 'accepted'
  }, [])

  return { platform, canInstall, isInstalled, triggerInstall }
}
