'use client'

import { useEffect } from 'react'

/**
 * Warn guests before the tab closes that their state will be lost.
 *
 * Note: the HTML spec disallows custom messages on `beforeunload` since ~2016
 * (https://html.spec.whatwg.org/#the-window-object:dom-window-alert). Browsers
 * ignore `e.returnValue = '<custom>'` and render their own generic
 * "Changes you made may not be saved — Leave site?" prompt. We can only
 * trigger it or suppress it.
 *
 * Also fires on reload, which is technically a false alarm for us since
 * sessionStorage survives a reload — but there's no reliable way to tell
 * reload vs close from the event. Accepting the trade-off.
 */
export function useGuestBeforeUnloadWarning(active: boolean): void {
  useEffect(() => {
    if (!active) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      // Required for cross-browser compat (Chrome ignores preventDefault alone).
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [active])
}
