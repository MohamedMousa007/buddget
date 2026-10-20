'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { buildAuthHeaders, apiUrl, usesRemoteApi } from '@/lib/apiBase'

const TOKEN_KEY = 'buddget.admin.session'
const CSRF = { 'X-Requested-With': 'buddget-admin' }

/** Fired when the server says the admin session is gone, so the shell can return to the unlock screen. */
export const ADMIN_LOCKED_EVENT = 'buddget:admin-locked'

/** The cookie carries the session on web. Native (cross-origin API) keeps the token for the tab/app lifetime. */
export function setAdminToken(token: string | null): void {
  if (!usesRemoteApi()) return
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token)
    else sessionStorage.removeItem(TOKEN_KEY)
  } catch {
    /* storage blocked: the user simply unlocks again after a reload */
  }
}

function readAdminToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export class AdminApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message)
  }
}

export async function adminFetch<T = unknown>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init
  const headers = await buildAuthHeaders(rest.headers)
  for (const [k, v] of Object.entries(CSRF)) headers.set(k, v)
  const token = readAdminToken()
  if (token) headers.set('X-Admin-Session', token)
  if (json !== undefined) headers.set('Content-Type', 'application/json')

  const res = await fetch(apiUrl(path), {
    ...rest,
    headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    cache: 'no-store',
  })
  const data = (await res.json().catch(() => ({}))) as { error?: string; code?: string } & T
  if (!res.ok) {
    if (res.status === 401 && data.code === 'locked' && typeof window !== 'undefined') {
      window.dispatchEvent(new Event(ADMIN_LOCKED_EVENT))
    }
    throw new AdminApiError(data.error ?? 'Something went wrong.', res.status, data.code)
  }
  return data
}

export const adminPost = <T = { ok: true }>(path: string, json: unknown) => adminFetch<T>(path, { method: 'POST', json })

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong.'
}

export interface Query<T> {
  data: T | null
  error: string | null
  loading: boolean
  refresh: () => Promise<void>
}

// Last good response per path: going back to a list shows it at once. A response younger than STALE_MS is not
// refetched on remount (switching tabs back and forth costs nothing); older ones revalidate behind the cached copy.
const MAX_CACHED = 60
const STALE_MS = 15_000
const responseCache = new Map<string, { data: unknown; at: number }>()
const inflight = new Map<string, Promise<unknown>>()
const remember = (path: string, data: unknown) => {
  responseCache.delete(path)
  responseCache.set(path, { data, at: Date.now() })
  if (responseCache.size > MAX_CACHED) responseCache.delete(responseCache.keys().next().value as string)
}
// Nothing from a locked session may outlive it.
if (typeof window !== 'undefined') window.addEventListener(ADMIN_LOCKED_EVENT, () => { responseCache.clear(); inflight.clear() })

/** One request per path at a time: identical concurrent GETs share the same promise. */
function fetchOnce<T>(path: string): Promise<T> {
  let p = inflight.get(path) as Promise<T> | undefined
  if (!p) {
    p = adminFetch<T>(path).finally(() => inflight.delete(path))
    inflight.set(path, p)
  }
  return p
}

/** GET a admin endpoint; refetches when `path` changes. Shows the last response for that path immediately, then revalidates. */
export function useAdminQuery<T>(path: string | null): Query<T> {
  const [data, setData] = useState<T | null>(() => (path !== null ? ((responseCache.get(path)?.data as T | undefined) ?? null) : null))
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(path !== null)
  const seq = useRef(0)

  const load = useCallback(async (force = false) => {
    if (path === null) return
    const mine = ++seq.current
    const cached = responseCache.get(path)
    if (cached !== undefined) setData(cached.data as T)
    if (!force && cached !== undefined && Date.now() - cached.at < STALE_MS) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const next = await fetchOnce<T>(path)
      remember(path, next)
      if (mine === seq.current) {
        setData(next)
        setError(null)
      }
    } catch (e) {
      if (mine === seq.current) setError(errorMessage(e))
    } finally {
      if (mine === seq.current) setLoading(false)
    }
  }, [path])

  useEffect(() => {
    void load()
  }, [load])

  const refresh = useCallback(() => load(true), [load])
  return { data, error, loading, refresh }
}
