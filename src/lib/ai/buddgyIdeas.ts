import type { BuddgyMood } from '@/components/ai/BuddgyIcon'
import type { Dictionary } from '@/lib/i18n'
import type { OverspentCategory, PaceStatus } from '@/lib/utils/spendingPace'

/** App areas Buddgy tailors its ideas to. */
export type BuddgyScreen =
  | 'dashboard' | 'expenses' | 'debts' | 'savings' | 'goals' | 'income' | 'reports' | 'budget' | 'other'

const SCREEN_PREFIX: [string, BuddgyScreen][] = [
  ['/expenses', 'expenses'], ['/subscriptions', 'expenses'], ['/debts', 'debts'],
  ['/savings', 'savings'], ['/wealth', 'savings'], ['/investment', 'savings'], ['/goals', 'goals'],
  ['/income', 'income'], ['/reports', 'reports'], ['/budget-setup', 'budget'],
]

export function screenFromPath(pathname: string): BuddgyScreen {
  if (pathname === '/') return 'dashboard'
  return SCREEN_PREFIX.find(([p]) => pathname.startsWith(p))?.[1] ?? 'other'
}

/** The slice of the user's month that shapes what Buddgy suggests. */
export interface BuddgyIdeaContext {
  screen: BuddgyScreen
  paceStatus: PaceStatus
  overBudgetCategories: OverspentCategory[]
  hasBudget: boolean
  hasDebts: boolean
  hasGoals: boolean
  hasSpending: boolean
  /** Pre-formatted "safe to spend per day" amount, or null when not meaningful. */
  dailyAllowance: string | null
}

export interface BuddgyIdea {
  id: string
  /** Chip label — also what gets sent to Buddgy. */
  prompt: string
  kind: 'fix' | 'plan' | 'insight' | 'debt' | 'save'
}

export interface BuddgyNudge {
  id: string
  text: string
  prompt: string
  mood: BuddgyMood
}

/**
 * Up to four one-tap questions, most urgent first: a problem the user has right
 * now beats a question about the screen they're on, which beats a generic one.
 * Only asks what the model can answer from LIVE_APP_DATA.
 */
export function buddgyIdeas(ctx: BuddgyIdeaContext, t: Dictionary['buddgy']): BuddgyIdea[] {
  const ideas: BuddgyIdea[] = []
  const add = (id: string, prompt: string, kind: BuddgyIdea['kind'], when = true) => {
    if (when && !ideas.some((i) => i.id === id)) ideas.push({ id, prompt, kind })
  }
  const over = ctx.overBudgetCategories[0]

  if (over) add('over', t.chipOverCategory(over.category), 'fix')
  if (ctx.paceStatus !== 'on_track') add('pace', t.chipWillIMakeIt, 'fix')
  if (!ctx.hasBudget) add('build', t.chipBuildBudget, 'plan')

  const byScreen: Record<BuddgyScreen, () => void> = {
    dashboard: () => add('daily', t.chipDailyAllowance, 'insight', ctx.hasBudget),
    expenses: () => add('where', t.chipWhereMoneyWent, 'insight', ctx.hasSpending),
    debts: () => add('debt', t.chipDebtOrder, 'debt', ctx.hasDebts),
    savings: () => add('emergency', t.chipEmergencyFund, 'save'),
    goals: () => add('goals', t.chipSavingsPlan, 'save', ctx.hasGoals),
    income: () => add('split', t.chipSplitSalary, 'plan'),
    reports: () => add('summary', t.chipMonthSummary, 'insight', ctx.hasSpending),
    budget: () => add('build', t.chipBuildBudget, 'plan'),
    other: () => {},
  }
  byScreen[ctx.screen]()

  add('daily', t.chipDailyAllowance, 'insight', ctx.hasBudget)
  add('where', t.chipWhereMoneyWent, 'insight', ctx.hasSpending)
  add('debt', t.chipDebtOrder, 'debt', ctx.hasDebts)
  add('goals', t.chipSavingsPlan, 'save', ctx.hasGoals)
  add('summary', t.chipMonthSummary, 'insight', ctx.hasSpending)
  add('emergency', t.chipEmergencyFund, 'save')
  return ideas.slice(0, 4)
}

/**
 * The one thing worth saying unprompted on this screen, or null. Problems speak
 * up anywhere money is shown; otherwise Buddgy only offers help that fits the
 * screen, so a tip never feels random.
 */
export function buddgyNudge(ctx: BuddgyIdeaContext, t: Dictionary['buddgy']): BuddgyNudge | null {
  const over = ctx.overBudgetCategories[0]
  const moneyScreen = ctx.screen === 'dashboard' || ctx.screen === 'expenses' || ctx.screen === 'reports'

  if (over && moneyScreen) {
    const pct = over.cap > 0 ? Math.round((over.overBy / over.cap) * 100) : 100
    return { id: `over:${over.category}`, text: t.nudgeOverCategory(over.category, pct), prompt: t.chipOverCategory(over.category), mood: 'worried' }
  }
  if (ctx.paceStatus === 'over' && moneyScreen) {
    return { id: 'pace', text: t.nudgePaceOver, prompt: t.chipWillIMakeIt, mood: 'worried' }
  }
  switch (ctx.screen) {
    case 'dashboard':
      return ctx.dailyAllowance && ctx.paceStatus === 'on_track'
        ? { id: 'ontrack', text: t.nudgeOnTrack(ctx.dailyAllowance), prompt: t.chipDailyAllowance, mood: 'happy' }
        : null
    case 'expenses':
      return ctx.hasSpending ? { id: 'where', text: t.nudgeExpenses, prompt: t.chipWhereMoneyWent, mood: 'curious' } : null
    case 'debts':
      return ctx.hasDebts ? { id: 'debt', text: t.nudgeDebts, prompt: t.chipDebtOrder, mood: 'curious' } : null
    case 'savings':
      return { id: 'savings', text: t.nudgeSavings, prompt: t.chipEmergencyFund, mood: 'wink' }
    case 'goals':
      return ctx.hasGoals ? { id: 'goals', text: t.nudgeGoals, prompt: t.chipSavingsPlan, mood: 'curious' } : null
    case 'income':
      return { id: 'split', text: t.nudgeIncome, prompt: t.chipSplitSalary, mood: 'wink' }
    case 'reports':
      return ctx.hasSpending ? { id: 'summary', text: t.nudgeReports, prompt: t.chipMonthSummary, mood: 'curious' } : null
    default:
      return null
  }
}

/** Tip cadence: rare enough to stay welcome. */
export const NUDGE_RULES = {
  /** Seconds on a screen before Buddgy may speak — a glance is not an invitation. */
  dwellMs: 7000,
  minGapMs: 4 * 60_000,
  maxPerDay: 3,
  visibleMs: 9000,
  /** No tips between these local hours (Buddgy is asleep). */
  quietFrom: 23,
  quietTo: 7,
} as const

/** Whether a tip may show now, given today's log. */
export function nudgeAllowed(
  log: { day: string; count: number; lastAt: number; seen: string[] },
  id: string,
  now: Date,
): boolean {
  const hour = now.getHours()
  if (hour >= NUDGE_RULES.quietFrom || hour < NUDGE_RULES.quietTo) return false
  if (log.day !== now.toDateString()) return true
  return (
    log.count < NUDGE_RULES.maxPerDay &&
    now.getTime() - log.lastAt >= NUDGE_RULES.minGapMs &&
    !log.seen.includes(id)
  )
}

/** Maps a reply's self-reported feeling (or, failing that, its shape) to a face. */
export function moodForReply(r: { mood?: string; clarificationNeeded: string | null; actions: { action: string }[] }): BuddgyMood {
  switch (r.mood) {
    case 'happy': return 'happy'
    case 'proud': return 'wink'
    case 'playful': return 'wink'
    case 'worried': return 'worried'
    case 'curious': return 'curious'
    case 'neutral': return 'awake'
  }
  if (r.clarificationNeeded) return 'curious'
  return r.actions.some((a) => a.action !== 'query' && a.action !== 'unclear') ? 'happy' : 'awake'
}
