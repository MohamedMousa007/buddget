'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

function getWorkbox() {
  if (typeof window === 'undefined') return undefined
  return window.workbox
}

/**
 * Detects a waiting Workbox service worker and exposes apply via `SKIP_WAITING` + reload.
 * Uses `workbox.messageSkipWaiting()` when present (posts to the waiting SW); otherwise
 * `waiting.postMessage({ type: 'SKIP_WAITING' })`. Reloads on `controllerchange` or after a short timeout.
 * No-ops in development (next-pwa disabled) or without service workers.
 */
export function usePwaUpdate() {
  const [hasWaiting, setHasWaiting] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const workboxRef = useRef<NonNullable<ReturnType<typeof getWorkbox>> | null>(null)

  const updateAvailable = useMemo(() => hasWaiting && !dismissed, [hasWaiting, dismissed])

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') return
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    let cancelled = false
    let raf = 0
    let attempts = 0
    const maxRafAttempts = 300

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

    void navigator.serviceWorker.getRegistration().then((reg) => {
      if (cancelled || !reg) return
      registration = reg
      markIfWaiting(reg)
      reg.addEventListener('updatefound', () => onUpdateFound(reg))
      window.addEventListener('focus', onFocus)

      if (reg.installing) {
        onUpdateFound(reg)
      }
    })

    const onWorkboxWaiting = () => {
      if (!cancelled) setHasWaiting(true)
    }

    const attachWorkbox = () => {
      if (cancelled) return
      const wb = getWorkbox()
      if (!wb) {
        attempts += 1
        if (attempts < maxRafAttempts) {
          raf = window.requestAnimationFrame(attachWorkbox)
        }
        return
      }
      if (!cancelled) {
        workboxRef.current = wb
        wb.addEventListener('waiting', onWorkboxWaiting)
      }
    }

    attachWorkbox()

    return () => {
      cancelled = true
      window.cancelAnimationFrame(raf)
      window.removeEventListener('focus', onFocus)
      const wb = workboxRef.current
      if (wb) {
        wb.removeEventListener('waiting', onWorkboxWaiting)
      }
    }
  }, [])

  const dismiss = useCallback(() => {
    setDismissed(true)
  }, [])

  const applyUpdate = useCallback(() => {
    const wb = workboxRef.current ?? getWorkbox()
    if (wb) {
      wb.messageSkipWaiting()
    } else {
      void navigator.serviceWorker.getRegistration().then((reg) => {
        reg?.waiting?.postMessage({ type: 'SKIP_WAITING' })
      })
    }

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
