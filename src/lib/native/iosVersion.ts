'use client'

import { useEffect, useState } from 'react'
import { isIOS, isNative } from '@/lib/native/isNative'
import { readOsVersion } from '@/lib/native/smsTracker'

/** iOS 27 imports the shared iCloud shortcut with its automation; older iOS builds it by hand. */
export const SHARED_SHORTCUT_MIN_IOS = 27

/** "27.1.2" -> 27; anything unreadable -> null. */
export function parseIosMajor(version: string | null | undefined): number | null {
  const major = Number.parseInt(version ?? '', 10)
  return Number.isFinite(major) && major > 0 ? major : null
}

/** Which setup guide a phone gets. Unknown version falls back to the manual guide, which works on every iOS. */
export function guideVariantFor(major: number | null): 'shortcut' | 'manual' {
  return major !== null && major >= SHARED_SHORTCUT_MIN_IOS ? 'shortcut' : 'manual'
}

// ponytail: one read per app launch; an iOS update restarts the app, so the cache never goes stale.
let cached: Promise<number | null> | null = null

export function getIosMajor(): Promise<number | null> {
  if (!isNative() || !isIOS()) return Promise.resolve(null)
  cached ??= readOsVersion().then(parseIosMajor)
  return cached
}

/** The iOS major version, `undefined` while reading, `null` when not iOS or unreadable. */
export function useIosMajor(): number | null | undefined {
  const [major, setMajor] = useState<number | null | undefined>(undefined)
  useEffect(() => {
    let live = true
    void getIosMajor().then((m) => { if (live) setMajor(m) })
    return () => { live = false }
  }, [])
  return major
}
