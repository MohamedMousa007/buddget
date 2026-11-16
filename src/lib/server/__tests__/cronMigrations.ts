import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

export interface CronJob {
  name: string
  schedule: string
  command: string
  file: string
  /** The migration that last set the schedule carries a `-- cron-frequency-reason:` comment. */
  hasReason: boolean
}

const MIGRATIONS = path.join(process.cwd(), 'supabase', 'migrations')

/** SQL with `--` comment lines removed, so rollback notes ("-- select cron.schedule(...)") are never read as real calls. */
export function stripComments(sql: string): string {
  return sql
    .split('\n')
    .filter((l) => !l.trim().startsWith('--'))
    .join('\n')
}

/**
 * Replays every migration in order and returns the jobs that end up scheduled:
 * cron.schedule('name', 'expr', 'command'), cron.alter_job((SELECT jobid ... jobname = 'name'), schedule := 'expr'),
 * cron.unschedule('name') and cron.unschedule(j) over unnest(ARRAY['a','b']). Jobs the live database holds that no migration
 * creates would be missed here; that is what the capture of notifications-hourly in 0300 fixed.
 */
export function replayCronJobs(files: { file: string; sql: string }[]): Map<string, CronJob> {
  const jobs = new Map<string, CronJob>()
  for (const { file, sql } of files) {
    const body = stripComments(sql)
    const hasReason = /--\s*cron-frequency-reason:/i.test(sql)
    for (const m of body.matchAll(/cron\.schedule\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*(\$(\w*)\$[\s\S]*?\$\4\$|'(?:[^']|'')*')\s*\)/g)) {
      jobs.set(m[1], { name: m[1], schedule: m[2], command: m[3].replace(/^\$\w*\$|\$\w*\$$|^'|'$/g, '').trim(), file, hasReason })
    }
    for (const m of body.matchAll(/cron\.alter_job\([\s\S]*?jobname\s*=\s*'([^']+)'[\s\S]*?\)\s*,\s*schedule\s*:=\s*'([^']+)'/g)) {
      const cur = jobs.get(m[1])
      if (cur) jobs.set(m[1], { ...cur, schedule: m[2], file, hasReason })
    }
    for (const m of body.matchAll(/cron\.unschedule\(\s*'([^']+)'\s*\)/g)) jobs.delete(m[1])
    for (const stmt of body.split(';')) {
      if (!/cron\.unschedule\(\s*[a-z_]+\s*\)/i.test(stmt)) continue
      for (const list of stmt.matchAll(/unnest\(\s*ARRAY\[([^\]]*)\]/gi)) for (const n of list[1].matchAll(/'([^']+)'/g)) jobs.delete(n[1])
    }
  }
  return jobs
}

export function loadMigrations(): { file: string; sql: string }[] {
  return readdirSync(MIGRATIONS)
    .filter((f) => /^\d+_.+\.sql$/.test(f))
    .sort()
    .map((file) => ({ file, sql: readFileSync(path.join(MIGRATIONS, file), 'utf8') }))
}

const field = (f: string, size: number): number[] | 'any' => {
  if (f === '*') return 'any'
  const step = /^\*\/(\d+)$/.exec(f)
  if (step) return Array.from({ length: Math.ceil(size / Number(step[1])) }, (_, i) => i * Number(step[1]))
  return f.split(',').map(Number)
}

/** Shortest gap in minutes between two runs of a 5-field cron expression (enough for the shapes used here). */
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

/** The latest `CREATE [OR REPLACE] FUNCTION public.<name>(` body across all migrations, or null. */
export function latestFunctionBody(files: { file: string; sql: string }[], fn: string): string | null {
  let found: string | null = null
  const head = new RegExp(`CREATE\\s+(?:OR\\s+REPLACE\\s+)?FUNCTION\\s+public\\.${fn}\\s*\\(`, 'gi')
  for (const { sql } of files) {
    for (const m of sql.matchAll(head)) {
      const rest = sql.slice(m.index!)
      const end = rest.search(/\bEND\s*(\$\$|\$function\$)/i)
      found = end === -1 ? rest : rest.slice(0, end)
    }
  }
  return found
}
