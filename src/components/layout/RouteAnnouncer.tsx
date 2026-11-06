'use client'

import { useEffect, useRef, useState } from 'react'
import { useNavPath } from '@/lib/navigation/navStore'
import { MAIN_ID, documentTitleFor, shouldMoveFocus } from './routeAnnounce'

/**
 * The in-memory view shell swaps whole screens without a page load, so the browser never updates the
 * tab title and a screen reader hears nothing. On each view change this sets `document.title` from the
 * new view's `h1`, announces it through a persistent polite live region, and moves focus to `<main>`.
 */
export function RouteAnnouncer() {
  const path = useNavPath()
  const first = useRef(true)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const initial = first.current
    first.current = false
    // Wait a tick so the new view's heading is mounted.
    const id = window.setTimeout(() => {
      const main = document.getElementById(MAIN_ID)
      const heading = main?.querySelector('h1')?.textContent ?? null
      document.title = documentTitleFor(heading)
      if (initial) return
      setMessage(heading ?? '')
      const active = document.activeElement
      const typing = active instanceof HTMLElement && (active.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName))
      if (shouldMoveFocus({ dialogOpen: !!document.querySelector('[aria-modal="true"]'), typing })) main?.focus({ preventScroll: true })
    }, 80)
    return () => window.clearTimeout(id)
  }, [path])

  return <div role="status" aria-live="polite" className="sr-only">{message}</div>
}
