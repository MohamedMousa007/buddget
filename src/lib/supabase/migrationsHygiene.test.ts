import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const DIR = join(__dirname, '..', '..', '..', 'supabase', 'migrations')

describe('REG-8: migrations never address a cron job by its numeric id', () => {
  it('no cron.alter_job / cron.unschedule with a literal job id', () => {
    const bad = readdirSync(DIR)
      .filter((f) => f.endsWith('.sql'))
      .filter((f) => /cron\.(alter_job|unschedule)\(\s*\d+/.test(readFileSync(join(DIR, f), 'utf8')))
    expect(bad).toEqual([])
  })
})
