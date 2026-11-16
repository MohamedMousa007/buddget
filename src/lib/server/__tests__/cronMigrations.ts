import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

export interface CronJob {
  name: string
  schedule: string
  command: string
  file: string
  /** The statement that last set the schedule sits directly under a `-- cron-frequency-reason:` comment. */
  hasReason: boolean
}

const MIGRATIONS = path.join(process.cwd(), 'supabase', 'migrations')
const REASON = /--\s*cron-frequency-reason:/i
const SCHEDULE_CALL = /cron\.schedule\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*(\$(\w*)\$[\s\S]*?\$\4\$|'(?:[^']|'')*')\s*\)/g
const ALTER_SCHEDULE_CALL = /cron\.alter_job\([\s\S]*?jobname\s*=\s*'([^']+)'[\s\S]*?\)\s*,\s*schedule\s*:=\s*'([^']+)'/g

/** SQL with `--` comment lines blanked (line count kept), so rollback notes ("-- select cron.schedule(...)") are never read as real calls. */
export function stripComments(sql: string): string {
  return sql
    .split('\n')
    .map((l) => (l.trim().startsWith('--') ? '' : l))
    .join('\n')
}

/** True when the comment block directly above the statement at `index` of `body` holds a reason (one reason covers one statement). */
function reasonAbove(rawLines: string[], body: string, index: number): boolean {
  for (let i = body.slice(0, index).split('\n').length - 2; i >= 0 && rawLines[i].trim().startsWith('--'); i--) {
    if (REASON.test(rawLines[i])) return true
  }
  return false
}

/**
 * Replays every migration in order and returns the jobs that end up scheduled:
 * cron.schedule('name', 'expr', 'command'), cron.alter_job((SELECT jobid ... jobname = 'name'), schedule := 'expr'),
 * cron.unschedule('name') and cron.unschedule(j) over unnest(ARRAY['a','b']). Any other shape of call is reported by
 * `unparsedCronCalls`, so a job cannot slip past by being written differently.
 */
export function replayCronJobs(files: { file: string; sql: string }[]): Map<string, CronJob> {
  const jobs = new Map<string, CronJob>()
  for (const { file, sql } of files) {
    const body = stripComments(sql)
    const raw = sql.split('\n')
    for (const m of body.matchAll(SCHEDULE_CALL)) {
      const command = m[3].replace(/^\$\w*\$|\$\w*\$$|^'|'$/g, '').trim()
      jobs.set(m[1], { name: m[1], schedule: m[2], command, file, hasReason: reasonAbove(raw, body, m.index!) })
    }
    for (const m of body.matchAll(ALTER_SCHEDULE_CALL)) {
      const cur = jobs.get(m[1])
      if (cur) jobs.set(m[1], { ...cur, schedule: m[2], file, hasReason: reasonAbove(raw, body, m.index!) })
    }
    for (const m of body.matchAll(/cron\.unschedule\(\s*'([^']+)'\s*\)/g)) jobs.delete(m[1])
    for (const stmt of body.split(';')) {
      if (!/cron\.unschedule\(\s*[a-z_]+\s*\)/i.test(stmt)) continue
      for (const list of stmt.matchAll(/unnest\(\s*ARRAY\[([^\]]*)\]/gi)) for (const n of list[1].matchAll(/'([^']+)'/g)) jobs.delete(n[1])
    }
  }
  return jobs
}

/** Files with a cron.schedule call, or an alter_job that changes a schedule, which the replay cannot read (named arguments, variables). */
export function unparsedCronCalls(files: { file: string; sql: string }[]): string[] {
  const out: string[] = []
  for (const { file, sql } of files) {
    const body = stripComments(sql)
    const schedules = body.match(/cron\.schedule\s*\(/g)?.length ?? 0
    const alters = [...body.matchAll(/cron\.alter_job\s*\(([\s\S]*?);/g)].filter((m) => /\bschedule\s*(:=|=>)/.test(m[1])).length
    if (schedules !== [...body.matchAll(SCHEDULE_CALL)].length || alters !== [...body.matchAll(ALTER_SCHEDULE_CALL)].length) out.push(file)
  }
  return out
}

export function loadMigrations(): { file: string; sql: string }[] {
  return readdirSync(MIGRATIONS)
    .filter((f) => /^\d+_.+\.sql$/.test(f))
    .sort()
    .map((file) => ({ file, sql: readFileSync(path.join(MIGRATIONS, file), 'utf8') }))
}

/**
 * The shapes the frequency rule understands: five fields, a minute that is one number, `*` or `*\/n`, and an hour that is a
 * number, a list, `*` or `*\/n`. Anything else (interval strings such as '10 seconds', minute ranges or lists) needs a reason.
 */
export function isSimpleSchedule(expr: string): boolean {
  const f = expr.trim().split(/\s+/)
  return (
    f.length === 5 &&
    /^(\*|\d{1,2}|\*\/\d{1,2})$/.test(f[0]) &&
    /^(\*|\d{1,2}(,\d{1,2})*|\*\/\d{1,2})$/.test(f[1]) &&
    f.slice(2).every((x) => /^[\d*,\-/]+$/.test(x))
  )
}

const field = (f: string, size: number): number[] | 'any' => {
  if (f === '*') return 'any'
  const step = /^\*\/(\d+)$/.exec(f)
  if (step) return Array.from({ length: Math.ceil(size / Number(step[1])) }, (_, i) => i * Number(step[1]))
  return f.split(',').map(Number)
}

/** Shortest gap in minutes between two runs of a 5-field cron expression. Only meaningful when `isSimpleSchedule` holds. */
export function minIntervalMinutes(expr: string): number {
  const [min, hour] = expr.trim().split(/\s+/)
  const minutes = field(min, 60)
  const hours = field(hour, 24)
  const gaps = (vals: number[], span: number) => (vals.length === 1 ? span : Math.min(...vals.map((v, i) => (i === vals.length - 1 ? vals[0] + span - v : vals[i + 1] - v))))
  if (hours !== 'any') {
    const stepH = gaps(hours, 24) * 60
    return minutes === 'any' ? 1 : minutes.length > 1 ? Math.min(gaps(minutes, 60), stepH) : stepH
  }
  if (minutes === 'any') return 1
  return minutes.length === 1 ? 60 : Math.min(gaps(minutes, 60), 60)
}

/** True when a job breaks the frequency rule: an unusual shape or more often than `minMinutes`, with no reason on its statement. */
export function breaksFrequencyRule(job: CronJob, minMinutes: number): boolean {
  if (job.hasReason) return false
  return !isSimpleSchedule(job.schedule) || minIntervalMinutes(job.schedule) < minMinutes
}

/**
 * Every body of `CREATE [OR REPLACE] FUNCTION public.<name>(` across all migrations, oldest first: the text between the
 * opening dollar quote after AS and its matching close ($$ or $tag$).
 */
export function functionBodies(files: { file: string; sql: string }[], fn: string): { file: string; body: string }[] {
  const out: { file: string; body: string }[] = []
  const head = new RegExp(`CREATE\\s+(?:OR\\s+REPLACE\\s+)?FUNCTION\\s+public\\.${fn}\\s*\\([\\s\\S]*?\\bAS\\s+(\\$\\w*\\$)`, 'gi')
  for (const { file, sql } of files) {
    for (const m of sql.matchAll(head)) {
      const start = m.index! + m[0].length
      const end = sql.indexOf(m[1], start)
      if (end !== -1) out.push({ file, body: sql.slice(start, end) })
    }
  }
  return out
}

/** The latest body of public.<fn>, or null. */
export function latestFunctionBody(files: { file: string; sql: string }[], fn: string): string | null {
  return functionBodies(files, fn).at(-1)?.body ?? null
}
