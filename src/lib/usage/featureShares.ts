import type { UsageState } from '@/lib/billing/billingStore'

type FeatureKey = 'chat' | 'receipt' | 'budget' | 'goals' | 'other'
const FEATURE_OF: Record<string, FeatureKey> = { chat: 'chat', chat_hop: 'chat', proxy: 'chat', voice: 'chat', receipt: 'receipt', budget: 'budget', goals: 'goals', goals_grounded: 'goals' }

/** This week's share of the total by feature, in whole percents (the largest first). Credits stay internal. */
export function featureShares(by: UsageState['byFeature']): Array<{ key: FeatureKey; pct: number }> {
  const sums = new Map<FeatureKey, number>()
  for (const [feature, credits] of Object.entries(by)) sums.set(FEATURE_OF[feature] ?? 'other', (sums.get(FEATURE_OF[feature] ?? 'other') ?? 0) + credits)
  const total = [...sums.values()].reduce((a, b) => a + b, 0)
  if (total <= 0) return []
  return [...sums.entries()].map(([key, v]) => ({ key, pct: Math.round((v / total) * 100) })).sort((a, b) => b.pct - a.pct)
}
