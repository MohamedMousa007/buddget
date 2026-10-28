/**
 * Learning-funnel coverage (LF4): per sender, how many SMS each tier handled and which shapes are still
 * unlearned. Pure aggregation over corpus rows; the admin page (package 3) feeds it from this view/RPC:
 *
 *   -- RPC admin_sms_coverage(): admin-only (sms.view), SECURITY DEFINER, returns no raw text
 *   SELECT sender_key,
 *          coalesce(parse_method, 'none') AS tier,
 *          sum(seen_count)  AS seen,
 *          sum(ok_count)    AS ok
 *   FROM sms_corpus GROUP BY 1, 2;
 *
 *   -- RPC admin_sms_top_unlearned(limit int): masked shapes only
 *   SELECT sender_key, redacted_body, seen_count, parse_method
 *   FROM sms_corpus
 *   WHERE coalesce(parse_method, 'ai_new') = 'ai_new' AND kind IS DISTINCT FROM 'rejected_tx_like'
 *   ORDER BY seen_count DESC LIMIT limit;
 */

export interface CorpusRow {
  sender_key: string | null
  redacted_body: string
  parse_method: string | null
  seen_count: number
  ok_count: number
}

export type CoverageTier = 'fully_curated' | 'curated_db' | 'template' | 'ai_new' | 'none'

export interface SenderCoverage {
  sender: string
  total: number
  byTier: Record<CoverageTier, number>
  /** Share of SMS handled without the paid AI tier. */
  freeShare: number
}

const TIERS: CoverageTier[] = ['fully_curated', 'curated_db', 'template', 'ai_new', 'none']

function tierOf(method: string | null): CoverageTier {
  return (TIERS as string[]).includes(method ?? '') ? (method as CoverageTier) : 'none'
}

export function computeCoverage(rows: readonly CorpusRow[]): SenderCoverage[] {
  const map = new Map<string, SenderCoverage>()
  for (const r of rows) {
    const sender = r.sender_key ?? 'unknown'
    const c = map.get(sender) ?? { sender, total: 0, byTier: { fully_curated: 0, curated_db: 0, template: 0, ai_new: 0, none: 0 }, freeShare: 0 }
    c.total += r.seen_count
    c.byTier[tierOf(r.parse_method)] += r.seen_count
    map.set(sender, c)
  }
  return [...map.values()]
    .map((c) => ({ ...c, freeShare: c.total ? (c.total - c.byTier.ai_new - c.byTier.none) / c.total : 0 }))
    .sort((a, b) => b.total - a.total)
}

/** The most frequent shapes still handled by the AI tier: where a new template pays off most. */
export function topUnlearnedShapes(rows: readonly CorpusRow[], limit = 20): Array<{ sender: string; shape: string; seen: number }> {
  return rows
    .filter((r) => tierOf(r.parse_method) === 'ai_new')
    .sort((a, b) => b.seen_count - a.seen_count)
    .slice(0, limit)
    .map((r) => ({ sender: r.sender_key ?? 'unknown', shape: r.redacted_body, seen: r.seen_count }))
}
