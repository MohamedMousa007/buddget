import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// The Hobby plan rejects the WHOLE deployment when any cron runs more than once a day, so every schedule here must be
// "<minute> <hour> * * *" with a fixed minute and hour. For anything more frequent use Supabase pg_cron + pg_net.
describe('vercel.json crons', () => {
  const { crons = [] } = JSON.parse(readFileSync(join(process.cwd(), 'vercel.json'), 'utf8')) as { crons?: { path: string; schedule: string }[] }

  it('has crons to check', () => expect(crons.length).toBeGreaterThan(0))

  it.each(crons)('$path runs at most once a day', ({ schedule }) => {
    const [minute, hour, dom, month, dow] = schedule.split(/\s+/)
    expect(/^\d+$/.test(minute), `minute in "${schedule}"`).toBe(true)
    expect(/^\d+$/.test(hour), `hour in "${schedule}"`).toBe(true)
    expect([dom, month, dow]).toEqual(['*', '*', '*'])
  })
})
