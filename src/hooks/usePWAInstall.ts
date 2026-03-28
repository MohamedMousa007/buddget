'use client'

import { useEffect, useState, useRef, useCallback } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export type InstallPlatform = 'android' | 'ios' | 'desktop' | 'installed' | 'unsupported'

export function usePWAInstall() {
  const [platform, setPlatform] = useState<InstallPlatform>('unsupported')
  const [canInstall, setCanInstall] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
      setPlatform('installed')
      return
    }

    const ua = navigator.userAgent
    const isIOS = /iphone|ipad|ipod/i.test(ua)
    const isAndroid = /android/i.test(ua)
    const isSafari = /safari/i.test(ua) && !/chrome/i.test(ua)

    if (isIOS && isSafari) {
      setPlatform('ios')
      setCanInstall(true)
      return
    }
    if (isAndroid) setPlatform('android')
    else if (!isIOS) setPlatform('desktop')

    const handler = (e: Event) => {
      e.preventDefault()
      deferredPrompt.current = e as BeforeInstallPromptEvent
      setCanInstall(true)
    }
    const onInstalled = () => {
      setIsInstalled(true)
      setPlatform('installed')
      setCanInstall(false)
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
