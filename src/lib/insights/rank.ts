import { DETECTORS } from './detectors'
import type { Insight, InsightInput } from './types'

/** Findings Free users see in full; the rest show the sentence with the amounts hidden. */
export const FREE_INSIGHTS = 3

/** Highest score first, but the first three come from different areas so the top of the page is varied. */
export function rankInsights(found: readonly Insight[]): Insight[] {
  const sorted = [...found].sort((a, b) => b.score - a.score)
  const head: Insight[] = []
  const used = new Set<string>()
  // The free slots go to findings Free can read, one per area, so a Pro pattern never takes a Free user's place.
  for (const f of sorted) {
    if (head.length < FREE_INSIGHTS && !f.pro && !used.has(f.area)) {
      head.push(f)
      used.add(f.area)
    }
  }
  return [...head, ...sorted.filter((f) => !head.includes(f))]
}

export function computeInsights(input: InsightInput): Insight[] {
  return rankInsights(DETECTORS.map((d) => d(input)).filter((x): x is Insight => x !== null))
}
