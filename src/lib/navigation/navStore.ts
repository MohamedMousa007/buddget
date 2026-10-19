'use client'

import { useSyncExternalStore } from 'react'
import { configuredAdminHost, normalizeHost } from '@/lib/admin/host'

/**
 * Source of truth for the in-memory view shell. `navigate()` pushes to the
 * History API AND updates this store; `AppViewRouter` renders the view for
 * `currentPath`. We do NOT rely on Next's `usePathname` to drive the view swap
 * (its history-sync behaviour inside the Capacitor WebView is the one thing we
 * can't verify off-device) — this store owns the swap; `usePathname` still
 * updates for header/active-tab because `navigate()` also calls `pushState`.
 */

/** Strip a trailing slash (keep root as "/") so lookups are consistent whether
 *  the URL is `/expenses` or `/expenses/` (static export uses trailingSlash). */
export function normalizePath(path: string): string {
  if (!path) return '/'
  const noQuery = path.split('?')[0].split('#')[0]
  if (noQuery === '/' || noQuery === '') return '/'
  return noQuery.replace(/\/+$/, '')
}

/**
 * The shell view for a browser location. The admin host serves the portal at its root (the server rewrites `/` to
 * `/admin`), so the shell must not mistake that `/` for the Flow home page.
 */
export function shellPathFor(pathname: string, hostname: string): string {
  const path = normalizePath(pathname)
  return path === '/' && normalizeHost(hostname) === configuredAdminHost() ? '/admin' : path
}

const browserPath = () => shellPathFor(window.location.pathname, window.location.hostname)

let currentPath = typeof window !== 'undefined' ? browserPath() : '/'
const listeners = new Set<() => void>()

export function getNavPath(): string {
  return currentPath
}

export function setNavPath(path: string): void {
  const next = normalizePath(path)
  if (next === currentPath) return
  currentPath = next
  for (const l of listeners) l()
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

/** Reactive current shell path (normalized, no query/hash). */
export function useNavPath(): string {
  return useSyncExternalStore(subscribe, getNavPath, () => '/')
}

/** Keep the store in sync with browser back/forward. Call once at app root. */
export function bindPopState(): () => void {
  if (typeof window === 'undefined') return () => {}
  const onPop = () => setNavPath(browserPath())
  window.addEventListener('popstate', onPop)
  return () => window.removeEventListener('popstate', onPop)
}
