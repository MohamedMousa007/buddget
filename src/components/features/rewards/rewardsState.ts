import { STREAK_STRIP_WEEKS, type StreakWeek } from '@/components/features/membership/HotStreakCard'
import { isTierLocked, tierProgressPct } from '@/components/features/membership/tiers'
import type { RewardsState, TierKey, WeekState } from '@/lib/loyalty/rewardsTypes'

/**
 * The tier the rewards card shows. The server keeps an Elite member without Pro at Diamond; the card still shows what they have
 * earned (Elite, or Elite Founder for a founder), greyed and locked, so they can see what Pro brings back.
 */
export function cardTier(rewards: Pick<RewardsState, 'tier' | 'proActive' | 'points' | 'tiers' | 'founder'>): { tier: TierKey; locked: boolean } | null {
  if (!rewards.tier) return null
  const real = rewards.tier.key
  const elite = rewards.tiers.find((t) => t.key === 'elite')
  if (!rewards.proActive && real === 'diamond' && elite && rewards.points.lifetime >= elite.minPoints) {
    return { tier: rewards.founder ? 'founder' : 'elite', locked: true }
  }
  return { tier: real, locked: isTierLocked(real, rewards.proActive) }
}

/** Progress along the shown tier toward the next rung; a tier with nothing above it (or one only Pro unlocks) is full. */
export function cardProgress(rewards: Pick<RewardsState, 'points' | 'tiers' | 'nextTier'>, tier: TierKey): number {
  const floor = rewards.tiers.find((t) => t.key === tier)?.minPoints ?? 0
  return tierProgressPct(rewards.points.lifetime, floor, rewards.nextTier && rewards.nextTier.pointsToGo > 0 ? rewards.nextTier.minPoints : null)
}

const LOOK: Record<WeekState, StreakWeek> = { kept: 'kept', frozen: 'frozen', missed: 'missed', open: 'missed', before: 'missed' }

/** The server's 12 weeks as the strip draws them: the last one is this week, lit when kept and ringed while it is still open. */
export function stripWeeks(weeks: RewardsState['streak']['weeks']): StreakWeek[] {
  return weeks.map((w, i) => (i === weeks.length - 1 ? (w.state === 'kept' ? 'current' : w.state === 'frozen' ? 'frozen' : 'pending') : LOOK[w.state]))
}

/** The day loyalty went live (Pro, Rewards and Invites shipped with migrations 0306-0314, applied on live 2026-11-17). No week before it is ever drawn. */
export const LOYALTY_START = '2026-11-17'

/**
 * This week's number on the server's week grid, counted from week 1: the week the user joined, or the week loyalty launched
 * for anyone who joined earlier. Both dates are YYYY-MM-DD.
 */
export function weekSinceJoin(thisWeekStart: string, joinedOn: string): number {
  const start = joinedOn > LOYALTY_START ? joinedOn : LOYALTY_START
  const days = Math.round((Date.parse(thisWeekStart) - Date.parse(start)) / 86_400_000)
  return Math.max(1, Math.floor((days + 6) / 7) + 1)
}

/**
 * The strip from the week the user joined: week 1 first, weeks not reached yet dashed; once past 12 weeks, the latest 12.
 * The server's last week is week `weekNow`; its weeks before week 1 are never shown.
 */
export function streakStrip(weeks: RewardsState['streak']['weeks'], weekNow: number): { cells: Array<{ week: StreakWeek; n: number }>; from: number; to: number; shown: RewardsState['streak']['weeks'] } {
  const look = stripWeeks(weeks)
  const from = Math.max(1, weekNow - STREAK_STRIP_WEEKS + 1)
  const cells = Array.from({ length: STREAK_STRIP_WEEKS }, (_, i) => {
    const n = from + i
    return { n, week: n > weekNow ? 'future' as const : look[look.length - 1 - (weekNow - n)] ?? 'missed' }
  })
  return { cells, from, to: weekNow, shown: weeks.slice(-(weekNow - from + 1)) }
}

export function stripCounts(weeks: RewardsState['streak']['weeks']): { kept: number; frozen: number; missed: number } {
  const count = (s: WeekState) => weeks.filter((w) => w.state === s).length
  return { kept: count('kept'), frozen: count('frozen'), missed: count('missed') }
}

/** Points the current streak has paid: 10 a kept week, x1.5 from week 4 and x2 from week 8 (docs/launch/PRO_REWARDS_SPEC.md section 2). */
export function streakPoints(weeks: number, base = 10): number {
  let total = 0
  for (let w = 1; w <= weeks; w++) total += base * (w >= 8 ? 2 : w >= 4 ? 1.5 : 1)
  return total
}

export type ShopRowState = 'buy' | 'owned' | 'in_use' | 'unavailable'

/** What a shop row offers now: a cosmetic already owned is applied instead of bought; a repair needs a week that can still be repaired. */
export function shopRowState(item: RewardsState['shop'][number], rewards: Pick<RewardsState, 'cosmetics' | 'streak' | 'freezes'>): ShopRowState {
  if (item.kind === 'repair') return rewards.streak.repair ? 'buy' : 'unavailable'
  if (item.kind === 'freeze') return rewards.freezes.banked >= rewards.freezes.max ? 'unavailable' : 'buy'
  const owned = rewards.cosmetics.owned.some((o) => o.kind === item.kind && o.key === item.item)
  if (!owned) return 'buy'
  const applied = item.kind === 'card_finish' ? rewards.cosmetics.cardFinish : rewards.cosmetics.buddgyLook
  return applied === item.item ? 'in_use' : 'owned'
}

/** The cosmetic a member goes back to when they stop using an alternate one. */
export const STANDARD_COSMETIC = { card_finish: 'standard', buddgy_look: 'classic' } as const
