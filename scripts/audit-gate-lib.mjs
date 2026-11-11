// Pure evaluation of an `npm audit --json` report for scripts/audit-gate.mjs (kept apart so it can be unit-tested).

/** Root-cause advisories of a vulnerability: follows transitive `via` names down to the advisory objects. */
export function rootAdvisories(vulnerabilities, name, seen = new Set()) {
  if (seen.has(name)) return []
  seen.add(name)
  const entry = vulnerabilities[name]
  if (!entry) return [{ unknown: name }]
  return entry.via.flatMap((v) => (typeof v === 'string' ? rootAdvisories(vulnerabilities, v, seen) : [v]))
}

const ghsaOf = (advisory) => advisory.url?.match(/GHSA-[a-z0-9-]+/i)?.[0]

/**
 * High/critical vulnerabilities that are not covered by an unexpired allowlist entry.
 * `allow` maps a GHSA id to its expiry date (YYYY-MM-DD); a vulnerability passes only when EVERY root advisory behind it is
 * allowlisted and unexpired, so a new advisory on an already-allowed package still blocks.
 */
export function blockingVulnerabilities(report, allow, now = new Date()) {
  return Object.entries(report.vulnerabilities).filter(([name, v]) => {
    if (v.severity !== 'high' && v.severity !== 'critical') return false
    const roots = rootAdvisories(report.vulnerabilities, name)
    return !roots.every((a) => {
      const id = ghsaOf(a)
      return id !== undefined && allow[id] !== undefined && now <= new Date(`${allow[id]}T23:59:59Z`)
    })
  })
}
