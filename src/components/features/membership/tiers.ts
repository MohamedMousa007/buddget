import type { CSSProperties } from 'react'

/** Loyalty tiers in rank order (docs/launch/PRO_REWARDS_SPEC.md section 2). */
export const TIER_ORDER = ['silver', 'emerald', 'diamond', 'elite', 'founder'] as const
export type TierKey = (typeof TIER_ORDER)[number]

export type TierGlyph = 'chevron' | 'gem' | 'diamond' | 'crown' | 'crownstar'

/** Hexagon badge: the metal gradient (top-left to bottom-right) and the glyph. Elite and Elite Founder add the bevel ring. */
export const TIER_BADGE: Record<TierKey, { metal: readonly string[]; glyph: TierGlyph; ring: boolean }> = {
  silver: { metal: ['#f4f7f8', '#a9b3b7', '#ffffff', '#7f898d', '#e3e9eb'], glyph: 'chevron', ring: false },
  emerald: { metal: ['#0b3d2c', '#39d79a', '#0f6a49', '#8ff3c9', '#0a3a2a'], glyph: 'gem', ring: false },
  diamond: { metal: ['#e6f8ff', '#8fd3ff', '#ffffff', '#b9a9ff', '#7cc8f0'], glyph: 'diamond', ring: false },
  elite: { metal: ['#4f0510', '#d0142f', '#ffc2c7', '#a80d24', '#3a030b'], glyph: 'crown', ring: true },
  founder: { metal: ['#6b4f16', '#edc463', '#fff1c4', '#0f6a49', '#39d79a'], glyph: 'crownstar', ring: true },
}

/**
 * Letterpress card: the stock (two stops), the type colour and the three-stop foil, per tier. `accent` is the wordmark's "d":
 * the brand teal that reads on that stock (deep teal on Silver's pale stock, the bright teal on the dark ones).
 */
export const TIER_PRESS: Record<TierKey, { stock: readonly [string, string]; text: string; foil: readonly [string, string, string]; accent: string }> = {
  silver: { stock: ['#ecebe6', '#cfccc4'], text: '#2a2d2f', foil: ['#9aa2a7', '#3a4146', '#1d2225'], accent: '#0d8578' },
  emerald: { stock: ['#1f5a43', '#0d2e22'], text: '#d9f5e8', foil: ['#fff3c9', '#d9ab45', '#8c6a22'], accent: '#6fe0d0' },
  diamond: { stock: ['#1f3a5a', '#0c1a2c'], text: '#dcecfa', foil: ['#ffffff', '#b9c7d2', '#6e7f8c'], accent: '#6fe0d0' },
  elite: { stock: ['#7a1222', '#3a050d'], text: '#ffe3e7', foil: ['#fff3c9', '#d9ab45', '#8c6a22'], accent: '#6fe0d0' },
  founder: { stock: ['#1b1915', '#090807'], text: '#efe6cf', foil: ['#fff3c9', '#e2b955', '#8c6a22'], accent: '#6fe0d0' },
}

/** The CSS custom properties the letterpress face reads. */
export function tierPressVars(tier: TierKey): CSSProperties {
  const p = TIER_PRESS[tier]
  return { '--l0': p.stock[0], '--l1': p.stock[1], '--lt': p.text, '--f0': p.foil[0], '--f1': p.foil[1], '--f2': p.foil[2], '--wm': p.accent } as CSSProperties
}

/** 1-based rank: Silver 1 ... Elite Founder 5. */
export const tierRank = (tier: TierKey): number => TIER_ORDER.indexOf(tier) + 1

/** Elite and Elite Founder need an active Pro (a trial counts). */
export const isProOnlyTier = (tier: TierKey): boolean => tier === 'elite' || tier === 'founder'

/** The card is shown locked when the tier needs Pro and Pro is not active. */
export const isTierLocked = (tier: TierKey, proActive: boolean): boolean => isProOnlyTier(tier) && !proActive

/** Progress along the current tier, 0 to 100. A tier with nothing above it is full. */
export function tierProgressPct(points: number, floor: number, nextFloor: number | null): number {
  if (nextFloor === null || nextFloor <= floor) return 100
  return Math.min(100, Math.max(0, Math.round(((points - floor) / (nextFloor - floor)) * 100)))
}

export type LadderRowState = 'done' | 'current' | 'ahead'

export function ladderRowState(row: TierKey, current: TierKey): LadderRowState {
  const d = TIER_ORDER.indexOf(row) - TIER_ORDER.indexOf(current)
  return d < 0 ? 'done' : d === 0 ? 'current' : 'ahead'
}
