import { priceConsensus, type ConsensusResult } from '@/lib/prices/consensus'
import { saghaWithinSanity } from '@/lib/prices/egyptGold'
import { EGYPT_SAGHA_SOURCES } from '@/lib/prices/egyptSaghaSources'

/**
 * Resolve the consensus Sagha dollar from already-fetched HTML, keyed by source id.
 *
 * Pure — the cron does the fetching, this does the judging: extract each source's implied Sagha,
 * drop anything outside the sanity band (a broken scrape or a JS-rendered zero self-eliminates
 * here), then cluster the survivors. Split out so it's testable without the network.
 */
export function resolveEgyptSaghaFromHtml(
  htmlById: Record<string, string | null | undefined>,
  ctx: { ounceUsd: number; officialUsdEgp: number },
  tolerance = 0.015,
): ConsensusResult {
  const samples = []
  for (const src of EGYPT_SAGHA_SOURCES) {
    const html = htmlById[src.id]
    if (!html) continue
    const v = src.extract(html, ctx)
    if (v === null || !saghaWithinSanity(v, ctx.officialUsdEgp)) continue
    samples.push({ value: v, source: src.id, upstream: src.upstream })
  }
  return priceConsensus(samples, tolerance)
}
