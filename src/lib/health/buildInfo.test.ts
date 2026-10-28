import { describe, expect, it } from 'vitest'
import { ageSeconds, buildInfo } from './buildInfo'

describe('buildInfo', () => {
  it('reports the version and a short commit, and nothing secret', () => {
    const info = buildInfo({ VERCEL_GIT_COMMIT_SHA: 'c61f603872190618390feaa6ad3ea579fbaa46de', VERCEL_REGION: 'fra1', SUPABASE_SERVICE_ROLE_KEY: 'x' })
    expect(info).toEqual({ version: expect.any(String), commit: 'c61f603', region: 'fra1' })
    expect(JSON.stringify(info)).not.toContain('x"')
  })
  it('has nulls instead of throwing outside Vercel', () => {
    expect(buildInfo({})).toMatchObject({ commit: null, region: null })
  })
})

describe('ageSeconds', () => {
  const now = Date.parse('2026-10-23T12:00:00Z')
  it('measures the age of a cached value', () => {
    expect(ageSeconds('2026-10-23T11:59:30Z', now)).toBe(30)
    expect(ageSeconds('2026-10-23T12:00:05Z', now)).toBe(0)
  })
  it('is null when there is nothing to measure', () => {
    expect(ageSeconds(null, now)).toBeNull()
    expect(ageSeconds('not a date', now)).toBeNull()
  })
})
