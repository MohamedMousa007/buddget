'use client'

import { useSyncExternalStore } from 'react'

/**
 * The portal is one page with in-memory views, like the app shell: switching sections is instant, deep links keep
 * working (`/admin?s=users&id=…`), and nothing depends on App Router segment fetching inside the native WebView.
 */
export interface AdminRoute {
  section: string
  params: Record<string, string>
}

const DEFAULT_SECTION = 'overview'

function parse(): AdminRoute {
  if (typeof window === 'undefined') return { section: DEFAULT_SECTION, params: {} }
  const q = new URLSearchParams(window.location.search)
  const params: Record<string, string> = {}
  q.forEach((v, k) => {
    if (k !== 's') params[k] = v
  })
  return { section: q.get('s') || DEFAULT_SECTION, params }
}

const SERVER_ROUTE: AdminRoute = { section: DEFAULT_SECTION, params: {} }

let current: AdminRoute = parse()
let snapshotKey = JSON.stringify(current)
const listeners = new Set<() => void>()

/** Re-read the address bar: the portal can be re-entered by an in-app navigation that fires no popstate. */
export function syncAdminRoute(): void {
  publish()
}

function publish(): void {
  const next = parse()
  const key = JSON.stringify(next)
  if (key === snapshotKey) return
  current = next
  snapshotKey = key
  listeners.forEach((l) => l())
}

if (typeof window !== 'undefined') window.addEventListener('popstate', publish)

export function adminNavigate(section: string, params: Record<string, string> = {}, opts: { replace?: boolean } = {}): void {
  const q = new URLSearchParams({ s: section, ...params })
  const url = `${window.location.pathname}?${q.toString()}`
  if (opts.replace) window.history.replaceState(null, '', url)
  else window.history.pushState(null, '', url)
  publish()
  window.scrollTo(0, 0)
}

export function useAdminRoute(): AdminRoute {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => current,
    () => SERVER_ROUTE,
  )
}
