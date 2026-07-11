'use client'

import { normalizePath, setNavPath } from './navStore'
import { isShellPath } from './shellRoutes'

/** Add a trailing slash to the path portion (keep query/hash) so a hard load
 *  resolves the static-export file at `<route>/index.html`. Root stays `/`. */
function withTrailingSlash(href: string): string {
  const m = href.match(/^([^?#]*)(.*)$/)
  const path = m ? m[1] : href
  const rest = m ? m[2] : ''
  if (path === '' || path === '/') return `/${rest}`
  if (path.endsWith('/')) return href
  return `${path}/${rest}`
}

export interface NavigateOptions {
  replace?: boolean
}

/**
 * The single navigation primitive. Shell routes swap the in-memory view via the
 * History API (instant, zero fetch, cannot wedge). Everything else does a full
 * document load (correct for routes with their own layout/session, still
 * wedge-proof because it's a fresh prerendered load).
 */
export function navigate(href: string, opts: NavigateOptions = {}): void {
  if (typeof window === 'undefined') return
  const path = normalizePath(href)
  if (isShellPath(path)) {
    if (opts.replace) window.history.replaceState(null, '', href)
    else window.history.pushState(null, '', href)
    setNavPath(path)
    window.scrollTo(0, 0)
    return
  }
  // Special / unknown context — full load.
  if (opts.replace) window.location.replace(withTrailingSlash(href))
  else window.location.assign(withTrailingSlash(href))
}
