// Merges sweep-<vp>-retry.json records over sweep-<vp>.json by tag (a retry replaces a timed-out record).
import fs from 'node:fs'
for (const v of (process.env.VPS || 'mobile,tablet,landscape,desktop').split(',')) {
  const f = `e2e/ui/out/sweep-${v}.json`, r = `e2e/ui/out/sweep-${v}-retry.json`
  if (!fs.existsSync(r)) continue
  const m = new Map(JSON.parse(fs.readFileSync(f)).map((x) => [x.tag, x]))
  for (const x of JSON.parse(fs.readFileSync(r))) if (!x.error || !m.has(x.tag) || m.get(x.tag).error) m.set(x.tag, x)
  fs.writeFileSync(f, JSON.stringify([...m.values()], null, 1))
}
