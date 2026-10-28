import { describe, it, expect, afterEach } from 'vitest'
import { isAuthorizedCron } from './cronAuth'

const req = (auth?: string) => new Request('http://x/api/cron', { headers: auth ? { authorization: auth } : {} })

describe('isAuthorizedCron', () => {
  const prev = process.env.CRON_SECRET
  afterEach(() => {
    if (prev === undefined) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = prev
  })

  it('accepts the exact bearer secret', () => {
    process.env.CRON_SECRET = 's3cret'
    expect(isAuthorizedCron(req('Bearer s3cret'))).toBe(true)
  })
  it('rejects wrong, missing and different-length headers', () => {
    process.env.CRON_SECRET = 's3cret'
    expect(isAuthorizedCron(req('Bearer s3creT'))).toBe(false)
    expect(isAuthorizedCron(req('Bearer s3cret-longer'))).toBe(false)
    expect(isAuthorizedCron(req())).toBe(false)
  })
  it('rejects everything when the secret is unset', () => {
    delete process.env.CRON_SECRET
    expect(isAuthorizedCron(req('Bearer '))).toBe(false)
    expect(isAuthorizedCron(req('Bearer undefined'))).toBe(false)
  })
})
