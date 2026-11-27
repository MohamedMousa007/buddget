/**
 * The client contract version: bumped whenever an app release depends on server behaviour old releases cannot
 * follow (delta sync, the nudge channel). The server compares it with the minimum set in the admin portal
 * (Platform > Minimum app version) and refuses older releases with "update required". Native marketing versions
 * are kept equal to it at release time so the store and the portal speak the same number.
 */
export const APP_CLIENT_VERSION = '1.1.0'

const parts = (v: string): number[] => v.split('.').map((n) => Number.parseInt(n, 10) || 0)

/** True when `version` is older than `min`. Missing or malformed versions count as 0.0.0. */
export function isVersionBelow(version: string | null | undefined, min: string | null | undefined): boolean {
  if (!min) return false
  const a = parts(version ?? '0')
  const b = parts(min)
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0)
    if (d !== 0) return d < 0
  }
  return false
}
