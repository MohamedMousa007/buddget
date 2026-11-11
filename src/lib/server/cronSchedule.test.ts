import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('DBI-9: one scheduler for /api/cron/notifications', () => {
  it('vercel.json does not schedule it (pg_cron job 15 is the scheduler)', () => {
    const { crons } = JSON.parse(readFileSync('vercel.json', 'utf8')) as { crons: { path: string }[] }
    expect(crons.map((c) => c.path)).not.toContain('/api/cron/notifications')
    expect(new Set(crons.map((c) => c.path)).size).toBe(crons.length)
  })
})
