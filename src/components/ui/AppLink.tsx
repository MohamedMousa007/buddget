'use client'

import { forwardRef } from 'react'
import type { AnchorHTMLAttributes, MouseEvent } from 'react'
import { navigate } from '@/lib/navigation/navigate'
import { isNative } from '@/lib/native/isNative'

type AppLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  href: string
  replace?: boolean
}

/**
 * Drop-in replacement for `next/link` inside the app shell. Renders a real
 * `<a href>` (accessibility, right-click/open-in-new-tab, correct URL) but
 * intercepts plain left-clicks and routes them through `navigate()` — instant
 * in-memory swap for shell routes, full load for everything else. Never uses
 * App Router client navigation, so it cannot wedge in the WebView.
 */
export const AppLink = forwardRef<HTMLAnchorElement, AppLinkProps>(function AppLink(
  { href, replace, onClick, ...rest },
  ref,
) {
  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e)
    // Respect modifier clicks / new-tab / non-primary buttons — let the browser handle them.
    if (
      e.defaultPrevented ||
      e.button !== 0 ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey ||
      (rest.target && rest.target !== '_self')
    ) {
      return
    }
    e.preventDefault()
    navigate(href, { replace })
  }

  // The WebView's long-press on a real <a> pops a native name+URL preview; the tap still routes through onClick.
  const nativeProps = isNative() ? { draggable: false, onContextMenu: (e: MouseEvent<HTMLAnchorElement>) => e.preventDefault() } : null

  return <a ref={ref} href={href} onClick={handleClick} {...rest} {...nativeProps} />
})
