'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { isNative } from '@/lib/native/isNative'

/**
 * Detects a waiting service worker and exposes apply via `SKIP_WAITING` + reload.
 * Posts `{ type: 'SKIP_WAITING' }` to the waiting worker. Reloads on `controllerchange` or after a short timeout.
 * No-ops in development (service worker disabled) or without service workers.
 */
export function usePwaUpdate() {
  const [hasWaiting, setHasWaiting] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  const updateAvailable = useMemo(() => hasWaiting && !dismissed, [hasWaiting, dismissed])

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') return
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    let cancelled = false

    const markIfWaiting = (reg: ServiceWorkerRegistration | undefined) => {
      if (!reg?.waiting || !reg.active) return
      setHasWaiting(true)
    }

    const onUpdateFound = (reg: ServiceWorkerRegistration) => {
      setDismissed(false)
      const installing = reg.installing
      if (!installing) return
      const onState = () => {
        if (cancelled) return
        if (installing.state === 'installed' && reg.waiting && reg.active) {
          setHasWaiting(true)
        }
      }
      installing.addEventListener('statechange', onState)
    }

    let registration: ServiceWorkerRegistration | null = null

    const onFocus = () => {
      void registration?.update()
    }

    const ready = isNative() ? navigator.serviceWorker.getRegistration() : navigator.serviceWorker.register('/sw.js').catch(() => undefined)
    void ready.then((reg) => {
      if (cancelled || !reg) return
      registration = reg
      markIfWaiting(reg)
      reg.addEventListener('updatefound', () => onUpdateFound(reg))
      window.addEventListener('focus', onFocus)

      if (reg.installing) {
        onUpdateFound(reg)
      }
    })

    return () => {
      cancelled = true
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  const dismiss = useCallback(() => {
    setDismissed(true)
  }, [])

  const applyUpdate = useCallback(() => {
    void navigator.serviceWorker.getRegistration().then((reg) => {
      reg?.waiting?.postMessage({ type: 'SKIP_WAITING' })
    })

    let reloaded = false
    const onControllerChange = () => {
      if (reloaded) return
      reloaded = true
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
      window.location.reload()
    }
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)
    window.setTimeout(() => {
      if (reloaded) return
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
      window.location.reload()
    }, 4000)
  }, [])

  return { updateAvailable, applyUpdate, dismiss }
}
