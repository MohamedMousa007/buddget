'use client'

import { useEffect, useRef, useState } from 'react'
import { useNavPath } from '@/lib/navigation/navStore'
import { useT } from '@/lib/i18n'
import { sectionTitleNavKey } from '@/lib/navigation/bottomNavConfig'
import { MAIN_ID, ROUTE_TITLE_SELECTOR, documentTitleFor, headingFor, shouldMoveFocus } from './routeAnnounce'

/**
 * The in-memory view shell swaps whole screens without a page load, so the browser never updates the
 * tab title and a screen reader hears nothing. On each view change this sets `document.title` from the
 * new view's `h1`, announces it through a persistent polite live region, and moves focus to `<main>`.
 */
export function RouteAnnouncer() {
  const path = useNavPath()
  const t = useT()
  const navKey = sectionTitleNavKey(path)
  const sectionTitle = navKey ? t.nav[navKey] : null
  const sectionTitleRef = useRef(sectionTitle)
  useEffect(() => { sectionTitleRef.current = sectionTitle }, [sectionTitle])
  const titleRef = useRef<string | null>(null)
  const setTitle = (title: string) => {
    titleRef.current = title
    document.title = title
  }
  const first = useRef(true)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const initial = first.current
    first.current = false
    // Wait a tick so the new view's heading is mounted.
    const id = window.setTimeout(() => {
      const main = document.getElementById(MAIN_ID)
      const heading = headingFor(main?.querySelector(ROUTE_TITLE_SELECTOR)?.textContent, sectionTitleRef.current)
      setTitle(documentTitleFor(heading))
      if (initial) return
      setMessage(heading ?? '')
      const active = document.activeElement
      const typing = active instanceof HTMLElement && (active.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName))
      if (shouldMoveFocus({ dialogOpen: !!document.querySelector('[aria-modal="true"]'), typing })) main?.focus({ preventScroll: true })
    }, 80)
    return () => window.clearTimeout(id)
  }, [path])

  useEffect(() => {
    setTitle(documentTitleFor(headingFor(document.getElementById(MAIN_ID)?.querySelector(ROUTE_TITLE_SELECTOR)?.textContent, sectionTitle)))
  }, [sectionTitle])

  // On a first load the framework writes its default <title> after hydration; keep the view's own title.
  useEffect(() => {
    const obs = new MutationObserver(() => {
      if (titleRef.current && document.title !== titleRef.current) document.title = titleRef.current
    })
    obs.observe(document.head, { childList: true, subtree: true, characterData: true })
    return () => obs.disconnect()
  }, [])

  return <div role="status" aria-live="polite" className="sr-only">{message}</div>
}
