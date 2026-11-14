'use client'

import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react'
import { useAuth } from '@/components/auth/auth-context'
import { apiFetchAuth } from '@/lib/apiBase'

export interface CarryCycle {
  monthKey: string
  posted: number
  recomputed: number
  delta: number
  stale: boolean
  currency: string
}

const NONE: CarryCycle[] = []
let owner: string | null = null
let cycles: CarryCycle[] = NONE
let fetching: Promise<void> | null = null
const listeners = new Set<() => void>()

function publish(uid: string, next: CarryCycle[]) {
  if (owner !== uid) return
  cycles = next
  listeners.forEach((l) => l())
}

async function load(uid: string): Promise<void> {
  try {
    const res = await apiFetchAuth('/api/savings/carry')
    const body = res.ok ? ((await res.json()) as { cycles?: CarryCycle[] }) : null
    publish(uid, body?.cycles ?? NONE)
  } catch {
    publish(uid, NONE)
  }
}

function fetchOnce(uid: string, force: boolean): Promise<void> {
  if (owner !== uid) {
    owner = uid
    cycles = NONE
    fetching = null
    listeners.forEach((l) => l())
  }
  if (force || !fetching) fetching = load(uid)
  return fetching
}

/** Closed months whose posted carry no longer matches their rows. Fetched once per app session; offline or failed reads leave it empty. */
export function useCarryStatus() {
  const { user } = useAuth()
  const uid = user?.id ?? null
  const all = useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l) } }, () => cycles, () => NONE)
  useEffect(() => {
    if (uid) void fetchOnce(uid, false)
  }, [uid])

  const refresh = useCallback(async () => {
    if (uid) await fetchOnce(uid, true)
  }, [uid])

  const apply = useCallback(async (monthKey: string): Promise<boolean> => {
    try {
      const res = await apiFetchAuth('/api/savings/carry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ monthKey }) })
      return res.ok
    } catch {
      return false
    }
  }, [])

  const staleCycles = useMemo(() => (owner === uid ? all.filter((c) => c.stale) : NONE), [all, uid])
  return { staleCycles, refresh, apply }
}
