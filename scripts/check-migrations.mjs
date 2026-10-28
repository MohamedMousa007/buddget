// CI gate: a migration number prefix may be used once. Prefixes that were already duplicated when this check was
// added (applied to production, so they cannot be renamed) are grandfathered at their current count; any NEW prefix
// reuse, or a further file under a grandfathered prefix, fails.
import { readdirSync } from 'node:fs'

const GRANDFATHERED = {
  '0065': 2, '0079': 2, '0092': 2, '0093': 2, '0096': 2, '0097': 2, '0098': 2, '0099': 2,
  '0100': 2, '0101': 2, '0102': 2, '0103': 2, '0198': 3, '0209': 2, '0210': 2,
}

const counts = new Map()
for (const f of readdirSync('supabase/migrations')) {
  const m = /^(\d+)_.+\.sql$/.exec(f)
  if (!m) continue
  counts.set(m[1], [...(counts.get(m[1]) ?? []), f])
}

const bad = [...counts].filter(([prefix, files]) => files.length > (GRANDFATHERED[prefix] ?? 1))
if (bad.length) {
  for (const [prefix, files] of bad) console.error(`Migration prefix ${prefix} used ${files.length}x (allowed ${GRANDFATHERED[prefix] ?? 1}):\n  ${files.join('\n  ')}`)
  process.exit(1)
}
console.log(`migration prefixes ok (${counts.size} distinct)`)
