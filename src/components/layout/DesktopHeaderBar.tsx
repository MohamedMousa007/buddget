'use client'

import { PAGE_HEADER_SURFACE_BASE } from '@/components/layout/PageHeader'
import { AuthNavButtons } from '@/components/layout/AuthNavButtons'

/** Desktop only: profile + settings (+ auth) aligned top-right beside sidebar. */
export function DesktopHeaderBar() {
  return (
    <header
      className={`hidden lg:flex fixed top-0 left-[200px] right-0 z-40 h-[52px] items-center justify-end px-6 ${PAGE_HEADER_SURFACE_BASE}`}
    >
      <AuthNavButtons />
    </header>
  )
}
