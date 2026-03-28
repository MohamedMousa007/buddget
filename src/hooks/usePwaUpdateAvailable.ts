'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

function getWorkbox() {
  if (typeof window === 'undefined') return undefined
  return window.workbox
}

/**
 * Detects a waiting Workbox service worker (new deployment) and exposes refresh via SKIP_WAITING + reload.
 * No-ops in development (next-pwa disabled) or without service workers.
 */
export function usePwaUpdateAvailable() {
  const [updateReady, setUpdateReady] = useState(false)
  const workboxRef = useRef<NonNullable<ReturnType<typeof getWorkbox>> | null>(null)

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') return
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    let cancelled = false
    let raf = 0
    let attempts = 0
    const maxRafAttempts = 300

    const markIfWaiting = (reg: ServiceWorkerRegistration | undefined) => {
      if (!reg?.waiting || !reg.active) return
      setUpdateReady(true)
    }

    const onUpdateFound = (reg: ServiceWorkerRegistration) => {
      const installing = reg.installing
      if (!installing) return
      const onState = () => {
        if (cancelled) return
        if (installing.state === 'installed' && reg.waiting && reg.active) {
          setUpdateReady(true)
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
      if (!cancelled) setUpdateReady(true)
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

  const refreshNow = useCallback(() => {
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

  return { updateReady, refreshNow }
}
