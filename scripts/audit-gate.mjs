// CI gate: fail on high/critical advisories in production dependencies, except the allowlisted packages below.
import { execSync } from 'node:child_process'

// next-pwa -> workbox-build -> rollup-plugin-terser -> serialize-javascript: build-time tooling that only runs
// during `next build` on our own sources, never in the shipped runtime. Remove once next-pwa is replaced.
const ALLOW = new Set(['serialize-javascript', 'rollup-plugin-terser', 'workbox-build'])

let out
try {
  out = execSync('npm audit --omit=dev --json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 20 * 1024 * 1024 })
} catch (e) {
  out = e.stdout // npm audit exits non-zero when it finds anything
}
let report
try {
  report = JSON.parse(out)
} catch {
  report = null
}
if (!report || report.error || typeof report.vulnerabilities !== 'object' || report.vulnerabilities === null) {
  console.error('audit gate failed closed: npm audit returned no vulnerabilities report', report?.error ?? '')
  process.exit(1)
}
const vulns = Object.entries(report.vulnerabilities)
const blocking = vulns.filter(([name, v]) => (v.severity === 'high' || v.severity === 'critical') && !ALLOW.has(name))
if (blocking.length) {
  for (const [name, v] of blocking) console.error(`${v.severity.toUpperCase()}  ${name}  ${JSON.stringify(v.range)}  fix: ${JSON.stringify(v.fixAvailable)}`)
  process.exit(1)
}
console.log(`audit gate ok (${vulns.length} advisories, none high/critical outside the allowlist)`)
