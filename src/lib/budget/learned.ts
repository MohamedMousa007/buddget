import type { EverydayKey } from '@/lib/budget/facts'

/**
 * What the app has learned about one person from how they treat its plans. Small enough to ride on the profile row,
 * so it syncs with the account and a rebuilt plan on any device starts from it.
 */
export interface Learned {
  v: 1
  /** Per everyday line: how far this person moves the engine's figure (1 = accepts it), and how many signals say so. */
  everyday?: Partial<Record<EverydayKey, { mult: number; n: number }>>
  /** Same for the safety-net line. */
  safety?: { mult: number; n: number }
  /** How often a plan was thrown away and rebuilt soon after; high means the first build misses. */
  rebuilds?: number
  /** Last rebuild, so a rebuild days after a build counts and one months later does not. */
  lastBuiltAt?: string
}

/** Never let learning move a figure further than this from what the engine says, whatever the signals. */
const MULT_MIN = 0.6
const MULT_MAX = 1.6
/** One signal moves the estimate by this share of the gap; later signals count a little less as n grows. */
const BASE_RATE = 0.5
/** Signals needed before the engine fully trusts a multiplier. */
const FULL_TRUST_AT = 3
const REBUILD_WINDOW_DAYS = 14

const clamp = (n: number) => Math.min(MULT_MAX, Math.max(MULT_MIN, n))

export type LearnTarget = { kind: 'everyday'; key: EverydayKey } | { kind: 'safety' }

function fold(prev: { mult: number; n: number } | undefined, ratio: number) {
  const n = (prev?.n ?? 0) + 1
  const rate = BASE_RATE / Math.sqrt(n)
  const mult = clamp((prev?.mult ?? 1) * (1 - rate) + ratio * rate)
  return { mult: Math.round(mult * 1000) / 1000, n }
}

/**
 * The person changed a figure the engine proposed (`from` to `to`). Ratios are bounded per signal so one extreme edit
 * (typing 0, or a typo) cannot swing the estimate.
 */
export function learnEdit(learned: Learned | undefined, target: LearnTarget, from: number, to: number): Learned {
  if (!(from > 0) || !(to >= 0)) return learned ?? { v: 1 }
  const ratio = Math.min(MULT_MAX, Math.max(MULT_MIN, to / from))
  const base: Learned = { ...(learned ?? { v: 1 }), v: 1 }
  if (target.kind === 'safety') return { ...base, safety: fold(base.safety, ratio) }
  return { ...base, everyday: { ...base.everyday, [target.key]: fold(base.everyday?.[target.key], ratio) } }
}

/** Month close: actual spending against the cap says whether the cap was right, a stronger signal than an edit. */
export function learnActual(learned: Learned | undefined, key: EverydayKey, planned: number, spent: number): Learned {
  if (!(planned > 0) || !(spent >= 0)) return learned ?? { v: 1 }
  // Only a clear miss teaches anything; spending 90 to 110% of a cap is the cap working.
  const ratio = spent / planned
  if (ratio > 0.9 && ratio < 1.1) return learned ?? { v: 1 }
  return learnEdit(learned, { kind: 'everyday', key }, planned, spent)
}

/** A plan was built. Returns whether it came soon after the previous build, which means that build missed. */
export function learnBuild(learned: Learned | undefined, now: Date): Learned {
  const prev = learned?.lastBuiltAt ? new Date(learned.lastBuiltAt) : null
  const quick = prev !== null && (now.getTime() - prev.getTime()) / 86_400_000 <= REBUILD_WINDOW_DAYS
  return { ...(learned ?? { v: 1 }), v: 1, rebuilds: (learned?.rebuilds ?? 0) + (quick ? 1 : 0), lastBuiltAt: now.toISOString() }
}

/** Multiplier the engine applies to a figure; trust ramps in with the number of signals. */
export function learnedMultiplier(entry: { mult: number; n: number } | undefined): number {
  if (!entry) return 1
  const trust = Math.min(1, entry.n / FULL_TRUST_AT)
  return 1 + (entry.mult - 1) * trust
}
