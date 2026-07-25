/**
 * Price consensus across multiple providers of the SAME asset class.
 *
 * Not a plain median — a median is dragged when 3 of 4 providers agree and one is an outlier
 * ([100, 130, 131, 132] → 130.5, but ~131 is the truth). We cluster values within a tolerance,
 * pick the cluster backed by the most DISTINCT upstream feeds (two vendors reselling one LBMA
 * feed are not independent corroboration, F17), and average that cluster.
 *
 * MUST only be given same-class samples: never mix spot-derived and true-local prices — that
 * would drag a local number toward spot and destroy the premium the local feed exists to capture.
 */

export interface PriceSample {
  value: number
  source: string
  /** Distinct upstream feed; two sources sharing one (e.g. both LBMA) count as one. Defaults to source. */
  upstream?: string
}

export type PriceConfidence = 'exact' | 'high' | 'low' | 'single' | 'unavailable'

export interface ConsensusResult {
  value: number | null
  confidence: PriceConfidence
  /** Sources backing the returned value. */
  sources: string[]
  /** Distinct upstream feeds backing it. */
  upstreams: number
}

const upstreamOf = (s: PriceSample) => s.upstream ?? s.source
const distinctUpstreams = (xs: PriceSample[]) => new Set(xs.map(upstreamOf)).size
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/**
 * @param tolerance relative band, e.g. 0.005 for ±0.5% (spot/pegged) or 0.015 for ±1.5% (local).
 */
export function priceConsensus(samples: PriceSample[], tolerance: number): ConsensusResult {
  const valid = samples.filter((s) => Number.isFinite(s.value) && s.value > 0)

  if (valid.length === 0) return { value: null, confidence: 'unavailable', sources: [], upstreams: 0 }
  if (valid.length === 1) {
    return { value: valid[0].value, confidence: 'single', sources: [valid[0].source], upstreams: 1 }
  }
  if (valid.every((s) => Math.abs(s.value - valid[0].value) < 1e-9)) {
    return {
      value: valid[0].value,
      confidence: 'exact',
      sources: valid.map((s) => s.source),
      upstreams: distinctUpstreams(valid),
    }
  }

  // Largest cluster by distinct upstreams, then member count, then tightest spread.
  let best: { members: PriceSample[]; ups: number; spread: number } | null = null
  for (const anchor of valid) {
    const members = valid.filter((s) => Math.abs(s.value - anchor.value) <= tolerance * anchor.value)
    const ups = distinctUpstreams(members)
    const vals = members.map((m) => m.value)
    const spread = Math.max(...vals) - Math.min(...vals)
    if (
      !best ||
      ups > best.ups ||
      (ups === best.ups && members.length > best.members.length) ||
      (ups === best.ups && members.length === best.members.length && spread < best.spread)
    ) {
      best = { members, ups, spread }
    }
  }

  if (best && best.ups >= 2) {
    return {
      value: mean(best.members.map((m) => m.value)),
      confidence: 'high',
      sources: best.members.map((m) => m.source),
      upstreams: best.ups,
    }
  }

  // No independently-corroborated cluster: fall back to the median of everything, flagged low.
  return {
    value: median(valid.map((s) => s.value)),
    confidence: 'low',
    sources: valid.map((s) => s.source),
    upstreams: distinctUpstreams(valid),
  }
}
