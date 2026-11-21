'use client'

import { useEffect, useState, type ComponentType } from 'react'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'

/** Loads the real sheet once the device is online; renders nothing until then (the sheets mount closed). */
function RetryLoad<P extends object>({ load, props }: { load: () => Promise<ComponentType<P>>; props: P }) {
  const { online } = useNetworkStatus()
  const [Sheet, setSheet] = useState<ComponentType<P> | null>(null)
  useEffect(() => {
    if (!online || Sheet) return
    let live = true
    load().then((c) => { if (live) setSheet(() => c) }, () => { /* still unreachable: the next reconnect tries again */ })
    return () => { live = false }
  }, [online, Sheet, load])
  return Sheet ? <Sheet {...props} /> : null
}

/**
 * A lazy sheet's loader that never rejects. A chunk that could not be fetched (offline before the prefetch landed) used
 * to reach the error boundary and crash the app; now the sheet stays absent and loads itself when the network returns.
 */
export function offlineSafe<P extends object>(load: () => Promise<ComponentType<P>>): () => Promise<ComponentType<P>> {
  return () => load().catch(() => function OfflineSheet(props: P) { return <RetryLoad load={load} props={props} /> })
}
