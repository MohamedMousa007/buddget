'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { WEB_APP_URL, type SiteLocale } from '@/lib/site/config'
import { pathFor, siteContent } from '@/lib/site/routes'

/** Mobile-only bar with the two main asks, shown once the visitor has scrolled past the first screen. */
export function StickyCta({ locale }: { locale: SiteLocale }) {
  const n = siteContent[locale].nav
  const [show, setShow] = useState(false)

  useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      const h = document.documentElement.scrollHeight
      setShow(window.scrollY > window.innerHeight * 0.9 && h - window.scrollY - window.innerHeight > window.innerHeight * 0.6)
    }
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(frame) }
  }, [])

  return (
    <div className={`sticky-cta${show ? ' show' : ''}`} aria-hidden={!show}>
      <Link className="pill pill-p" href={pathFor(locale, 'download')} data-track="cta" tabIndex={show ? 0 : -1}>{n.getAppShort}</Link>
      <a className="pill pill-g" href={WEB_APP_URL} data-track="cta" tabIndex={show ? 0 : -1}>{n.tryShort}</a>
    </div>
  )
}
