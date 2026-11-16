import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { latestFunctionBody, loadMigrations, minIntervalMinutes, replayCronJobs, stripComments } from './cronMigrations'

const MIN_MINUTES = 15
const migrations = loadMigrations()
const jobs = replayCronJobs(migrations)

describe('cron expressions', () => {
  it('computes the shortest gap', () => {
    expect(minIntervalMinutes('* * * * *')).toBe(1)
    expect(minIntervalMinutes('*/5 * * * *')).toBe(5)
    expect(minIntervalMinutes('*/15 * * * *')).toBe(15)
    expect(minIntervalMinutes('0 * * * *')).toBe(60)
    expect(minIntervalMinutes('17 4 * * *')).toBe(1440)
    expect(minIntervalMinutes('15 3 * * 0')).toBe(1440)
    expect(minIntervalMinutes('0,30 4 * * *')).toBe(30)
  })
})

describe('migration replay', () => {
  it('reads schedule, alter_job and unschedule (including the unnest form), ignoring comments', () => {
    const files = [
      { file: '1.sql', sql: "SELECT cron.schedule('a', '* * * * *', 'SELECT 1');\n-- select cron.schedule('ghost', '* * * * *', 'x');\nSELECT cron.schedule('b', '*/5 * * * *', $$SELECT 2$$);" },
      { file: '2.sql', sql: "SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname = 'b'), schedule := '0 * * * *');\nSELECT cron.unschedule(j) FROM unnest(ARRAY['a']) j;" },
    ]
    const out = replayCronJobs(files)
    expect([...out.keys()]).toEqual(['b'])
    expect(out.get('b')?.schedule).toBe('0 * * * *')
    expect(stripComments('-- x\nselect 1')).toBe('select 1')
    expect(replayCronJobs([{ file: 'c.sql', sql: "PERFORM cron.schedule('t', '40 1 * * *', $c$DELETE FROM x$c$);" }]).get('t')?.command).toBe('DELETE FROM x')
  })
})

describe('database load guardrails', () => {
  it('finds the jobs the database runs (a parser that sees none would pass everything)', () => {
    expect(jobs.size).toBeGreaterThanOrEqual(15)
    expect(jobs.has('crash_retention')).toBe(true)
    expect(jobs.has('sms-tick')).toBe(true)
    expect(jobs.has('notifications-hourly')).toBe(true)
    expect(jobs.has('admin-metrics')).toBe(false)
    expect(jobs.has('sms-pending-discards')).toBe(false)
  })

  it('no job runs more often than every 15 minutes without a "-- cron-frequency-reason:" comment in its migration', () => {
    const offenders = [...jobs.values()].filter((j) => minIntervalMinutes(j.schedule) < MIN_MINUTES && !j.hasReason).map((j) => `${j.name} (${j.schedule}) in ${j.file}`)
    expect(offenders).toEqual([])
  })

  it('the rule fails for a migration that schedules every minute with no reason', () => {
    const bad = replayCronJobs([{ file: 'x.sql', sql: "SELECT cron.schedule('noisy', '* * * * *', 'SELECT public.noisy()');" }]).get('noisy')!
    expect(minIntervalMinutes(bad.schedule) < MIN_MINUTES && !bad.hasReason).toBe(true)
    const ok = replayCronJobs([{ file: 'x.sql', sql: "-- cron-frequency-reason: needed\nSELECT cron.schedule('noisy', '* * * * *', 'SELECT public.noisy()');" }]).get('noisy')!
    expect(minIntervalMinutes(ok.schedule) < MIN_MINUTES && !ok.hasReason).toBe(false)
  })

  // Jobs that run more than once a day must stop early when idle. Inline statements are listed with the reason they are safe.
  const INLINE_INDEXED: Record<string, string> = {
    'api-rate-cleanup': 'a single DELETE on window_start, served by api_rate_limits_cleanup_idx; an empty range reads no rows',
  }
  it('every job that runs more than once a day calls a function with an early-exit guard (or is a listed indexed statement)', () => {
    const offenders: string[] = []
    for (const j of jobs.values()) {
      if (minIntervalMinutes(j.schedule) >= 1440) continue
      if (INLINE_INDEXED[j.name]) continue
      const fn = /public\.([a-z_0-9]+)\s*\(/i.exec(j.command)?.[1]
      const body = fn ? latestFunctionBody(migrations, fn) : null
      if (!fn || !body || !/\bIF\s+(NOT\s+)?EXISTS\b/i.test(body)) offenders.push(`${j.name}: ${fn ?? j.command.slice(0, 40)} has no early-exit guard`)
    }
    expect(offenders).toEqual([])
  })

  it('the listed inline statements are still scheduled (so the list cannot rot)', () => {
    for (const name of Object.keys(INLINE_INDEXED)) expect(jobs.has(name)).toBe(true)
  })

  it('docs/SCHEDULED_JOBS.md lists every pg_cron job and every Vercel cron', () => {
    const doc = readFileSync('docs/SCHEDULED_JOBS.md', 'utf8')
    const vercel = (JSON.parse(readFileSync('vercel.json', 'utf8')) as { crons: { path: string }[] }).crons.map((c) => c.path)
    const missing = [...jobs.keys(), ...vercel].filter((n) => !doc.includes(`\`${n}\``))
    expect(missing).toEqual([])
  })
})
