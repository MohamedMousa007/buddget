'use client'

import { useEffect } from 'react'
import { isIOS } from '@/lib/native/isNative'
import { runBackGuards } from '@/lib/navigation/backGuard'
import { goBack } from '@/lib/navigation/goBack'
import { navigate } from '@/lib/navigation/navigate'
import { getNavPath, shellCanGoBack } from '@/lib/navigation/navStore'
import { isIgnoredTarget, startsInEdge, swipeVerdict, type EdgeTarget } from '@/lib/navigation/edgeSwipe'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { isScrollLocked } from '@/lib/ui/scrollLock'

const computed = (el: EdgeTarget) => {
  const s = getComputedStyle(el as Element)
  return { overflowX: s.overflowX, touchAction: s.touchAction }
}

/**
 * iOS left-edge swipe = the app's back action (BDG-017). WKWebView's own back-forward gesture stays
 * off: it pops history before the back guards can close a sheet, goes back from tab roots, and has
 * no Flow fallback. Android's system back gesture arrives as Capacitor `backButton` instead.
 */
export function EdgeSwipeBack() {
  useEffect(() => {
    if (!isIOS()) return
    let tracking = false
    let rtl = false
    let startX = 0
    let startY = 0

    const onStart = (e: TouchEvent) => {
      tracking = false
      if (e.touches.length !== 1) return
      const { clientX, clientY } = e.touches[0]
      rtl = document.documentElement.dir === 'rtl'
      if (!startsInEdge(clientX, window.innerWidth, rtl)) return
      if (isIgnoredTarget(e.target as EdgeTarget | null, computed)) return
      startX = clientX
      startY = clientY
      tracking = true
    }
    const onMove = (e: TouchEvent) => {
      if (!tracking) return
      const t = e.touches[0]
      if (swipeVerdict(t.clientX - startX, t.clientY - startY, rtl, false) === 'cancel') tracking = false
    }
    const onEnd = (e: TouchEvent) => {
      if (!tracking) return
      tracking = false
      const t = e.changedTouches[0]
      if (!t || swipeVerdict(t.clientX - startX, t.clientY - startY, rtl, true) !== 'back') return
      const settings = useSettingsStore.getState()
      goBack('ios', {
        runGuards: runBackGuards,
        modalOpen: settings.activeModal !== null,
        closeModal: () => settings.setActiveModal(null),
        overlayLocked: isScrollLocked(),
        path: getNavPath(),
        canGoBack: shellCanGoBack(),
        historyBack: () => window.history.back(),
        navigate,
      })
    }
    const onCancel = () => { tracking = false }

    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onEnd, { passive: true })
    window.addEventListener('touchcancel', onCancel, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
      window.removeEventListener('touchcancel', onCancel)
    }
  }, [])

  return null
}
