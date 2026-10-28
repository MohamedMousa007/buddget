'use client'

import { useEffect, useState } from 'react'
import { apiFetchAuth } from '@/lib/apiBase'
import { getPlatform } from '@/lib/native/isNative'

let cached: Record<string, boolean> | null = null
let inflight: Promise<Record<string, boolean>> | null = null

function load(): Promise<Record<string, boolean>> {
  inflight ??= apiFetchAuth(`/api/flags?platform=${getPlatform()}`)
    .then((res) => (res.ok ? (res.json() as Promise<{ flags: Record<string, boolean> }>) : { flags: {} }))
    .then(({ flags }) => (cached = flags))
    .catch(() => (cached = {}))
  return inflight
}

/** Forget what was loaded, for a different account or after sign-out. */
export function resetFeatureFlags(): void {
  cached = null
  inflight = null
}

/** The flag for this user: null while loading, then true or false. A failed load reads as off. */
export function useFeatureFlag(key: string, enabled = true): boolean | null {
  const [value, setValue] = useState<boolean | null>(() => (cached ? (cached[key] ?? false) : null))
  useEffect(() => {
    if (!enabled) return
    let live = true
    void load().then((f) => live && setValue(f[key] ?? false))
    return () => {
      live = false
    }
  }, [key, enabled])
  return enabled ? value : null
}
