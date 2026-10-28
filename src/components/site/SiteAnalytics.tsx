'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { track } from './track'

/** Counts one view per page and one click per element marked `data-track="cta"`. */
export function SiteAnalytics() {
  const pathname = usePathname()

  useEffect(() => { track('view', pathname) }, [pathname])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if ((e.target as Element | null)?.closest('[data-track="cta"]')) track('cta_click')
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  return null
}
