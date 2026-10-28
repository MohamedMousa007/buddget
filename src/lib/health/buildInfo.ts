import pkg from '../../../package.json'

export interface BuildInfo {
  version: string
  commit: string | null
  region: string | null
}

/** What this deployment is, for a probe or a bug report. No secrets: the commit is public to anyone who can see the repo. */
export function buildInfo(env: Record<string, string | undefined> = process.env): BuildInfo {
  return {
    version: pkg.version,
    commit: env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    region: env.VERCEL_REGION ?? null,
  }
}

/** Seconds since an ISO time, never negative; null when there is no time or it cannot be read. */
export function ageSeconds(iso: string | null | undefined, now: number): number | null {
  const t = iso ? Date.parse(iso) : NaN
  return Number.isFinite(t) ? Math.max(0, Math.round((now - t) / 1000)) : null
}

/** Cached admin metrics older than this mean the refresh job has stopped. */
export const STALE_CACHE_SECONDS = 6 * 60 * 60
