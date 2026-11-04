import { everydayKeyOfName } from '@/lib/budget/engine'
import { learnActual, learnBuild, learnEdit, type Learned } from '@/lib/budget/learned'
import { stableSnapshot } from '@/lib/budget/flow/toFacts'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { FinancialProfile } from '@/lib/store/types'

/** Writes through the profile so the lesson syncs with the account and every device rebuilds from it. */
function saveLearned(next: (prev: Learned | undefined) => Learned, extra: Partial<FinancialProfile> = {}) {
  const { profile, updateProfile } = useFinanceStore.getState()
  const fp = profile.financialProfile ?? {}
  updateProfile({ financialProfile: { ...fp, ...extra, learned: next(fp.learned) } })
}

/**
 * The person changed a figure on a plan the engine built. Only everyday lines and the safety net teach anything: fixed
 * costs are facts, not estimates. Plans built by hand are the person's own numbers, so they teach nothing.
 */
export function learnFromLineEdit(planId: string, lineId: string, from: number, to: number): void {
  const plan = useFinanceStore.getState().budgetPlans.find((p) => p.id === planId)
  const line = plan?.categories.find((c) => c.id === lineId)
  if (!plan || !line || plan.origin !== 'ai' || from === to) return
  if (line.block === 'safety') return saveLearned((prev) => learnEdit(prev, { kind: 'safety' }, from, to))
  const key = line.block === 'everyday' ? everydayKeyOfName(line.name) : null
  if (key) saveLearned((prev) => learnEdit(prev, { kind: 'everyday', key }, from, to))
}

/** A closed month: where actual spending (the three-month average) missed an everyday cap by a clear margin. */
export function learnFromClose(proposals: ReadonlyArray<{ key?: string; from: number; average: number }>): void {
  const misses = proposals.flatMap((p) => {
    const name = p.key?.startsWith('everyday:') ? p.key.slice('everyday:'.length) : null
    const key = name ? everydayKeyOfName(name) : null
    return key ? [{ key, from: p.from, average: p.average }] : []
  })
  if (misses.length === 0) return
  saveLearned((prev) => misses.reduce<Learned | undefined>((acc, m) => learnActual(acc, m.key, m.from, m.average), prev) ?? { v: 1 })
}

/** The builder finished a plan: remember the stable answers and whether this build came soon after the last. */
export function recordBuild(answers: Record<string, unknown>, now = new Date()): void {
  const stable = stableSnapshot(answers as Parameters<typeof stableSnapshot>[0])
  const { profile } = useFinanceStore.getState()
  const prior = profile.financialProfile?.budgetProfile ?? {}
  saveLearned((prev) => learnBuild(prev, now), { budgetProfile: { ...prior, ...stable } })
}
