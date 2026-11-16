import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { breaksFrequencyRule, isSimpleSchedule, latestFunctionBody, loadMigrations, minIntervalMinutes, replayCronJobs, stripComments, unparsedCronCalls } from './cronMigrations'

const MIN_MINUTES = 15
const migrations = loadMigrations()
const jobs = replayCronJobs(migrations)
const one = (sql: string, name: string) => replayCronJobs([{ file: 'x.sql', sql }]).get(name)!

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

  it('treats interval strings, minute ranges and minute lists as shapes that need a reason', () => {
    for (const ok of ['*/15 * * * *', '0 * * * *', '17 4 * * *', '15 3 * * 0', '0 9,21 * * *']) expect(isSimpleSchedule(ok)).toBe(true)
    for (const odd of ['10 seconds', '30 seconds', '1-59 * * * *', '0-59/2 * * * *', '0,30 * * * *', '0 9-17 * * *', '@hourly']) expect(isSimpleSchedule(odd)).toBe(false)
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
    expect(stripComments('-- x\nselect 1')).toBe('\nselect 1')
    expect(replayCronJobs([{ file: 'c.sql', sql: "PERFORM cron.schedule('t', '40 1 * * *', $c$DELETE FROM x$c$);" }]).get('t')?.command).toBe('DELETE FROM x')
  })

  it('reports calls it cannot read, so a job cannot hide behind named arguments or a variable', () => {
    expect(unparsedCronCalls([{ file: 'n.sql', sql: "SELECT cron.schedule(job_name := 'n', schedule := '* * * * *', command := 'SELECT 1');" }])).toEqual(['n.sql'])
    expect(unparsedCronCalls([{ file: 'f.sql', sql: "SELECT cron.schedule('d', '* * * * *', format('SELECT %s', 1));" }])).toEqual(['f.sql'])
    expect(unparsedCronCalls([{ file: 'v.sql', sql: 'DO $$ BEGIN PERFORM cron.alter_job(j, schedule => \'* * * * *\'); END $$;' }])).toEqual(['v.sql'])
    expect(unparsedCronCalls([{ file: 'ok.sql', sql: "SELECT cron.schedule('a', '0 * * * *', 'SELECT 1');\nselect cron.alter_job((select jobid from cron.job where jobname = 'a'), command := 'SELECT 2');" }])).toEqual([])
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

  it('every cron call in the migrations is one the replay can read (0215 only re-timed admin-metrics, since removed)', () => {
    expect(unparsedCronCalls(migrations)).toEqual(['0215_b8_db_performance.sql'])
  })

  it('no job runs more often than every 15 minutes, or on an unusual schedule, without a reason on its own statement', () => {
    const offenders = [...jobs.values()].filter((j) => breaksFrequencyRule(j, MIN_MINUTES)).map((j) => `${j.name} (${j.schedule}) in ${j.file}`)
    expect(offenders).toEqual([])
  })

  it('the rule fails for sub-15-minute, interval-string, range and list schedules that carry no reason', () => {
    for (const expr of ['* * * * *', '10 seconds', '1-59 * * * *', '0-59/2 * * * *', '0,30 * * * *']) {
      expect(breaksFrequencyRule(one(`SELECT cron.schedule('noisy', '${expr}', 'SELECT public.noisy()');`, 'noisy'), MIN_MINUTES)).toBe(true)
    }
    expect(breaksFrequencyRule(one("-- cron-frequency-reason: needed\nSELECT cron.schedule('noisy', '10 seconds', 'SELECT public.noisy()');", 'noisy'), MIN_MINUTES)).toBe(false)
  })

  it('a reason exempts only the statement directly under it, not the rest of the file', () => {
    const sql = [
      '-- cron-frequency-reason: only for job a',
      "SELECT cron.schedule('a', '*/5 * * * *', 'SELECT 1');",
      '',
      "SELECT cron.schedule('noisy', '* * * * *', 'SELECT 2');",
      '-- cron-frequency-reason: covers the next line only',
      "SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname = 'a'), schedule := '*/2 * * * *');",
    ].join('\n')
    const out = replayCronJobs([{ file: 'x.sql', sql }])
    expect(breaksFrequencyRule(out.get('a')!, MIN_MINUTES)).toBe(false)
    expect(breaksFrequencyRule(out.get('noisy')!, MIN_MINUTES)).toBe(true)
  })

  // Jobs that run more than once a day must stop early when idle. Inline statements are listed with the reason they are safe.
  const INLINE_INDEXED: Record<string, string> = {
    'api-rate-cleanup': 'a single DELETE on window_start, served by api_rate_limits_cleanup_idx; an empty range reads no rows',
  }
  it('every job that runs more than once a day calls a function with an early-exit guard (or is a listed indexed statement)', () => {
    const offenders: string[] = []
    for (const j of jobs.values()) {
      if (isSimpleSchedule(j.schedule) && minIntervalMinutes(j.schedule) >= 1440) continue
      if (INLINE_INDEXED[j.name]) continue
      const fn = /public\.([a-z_0-9]+)\s*\(/i.exec(j.command)?.[1]
      const body = fn ? latestFunctionBody(migrations, fn) : null
      // A real guard probes a subquery: IF [NOT] EXISTS (SELECT ...). "CREATE TABLE IF NOT EXISTS" does not count.
      if (!fn || !body || !/\bIF\s+(NOT\s+)?EXISTS\s*\(/i.test(body)) offenders.push(`${j.name}: ${fn ?? j.command.slice(0, 40)} has no early-exit guard`)
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
