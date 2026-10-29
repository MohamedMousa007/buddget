import { describe, expect, it } from 'vitest'
import { maskPush } from './pushMask'

const msg = { title: 'Spent 250 EGP', body: '250 EGP at Talabat', data: { route: '/flow', amount: '250' } }

describe('maskPush', () => {
  it('leaves the content alone when notifications are not masked', () => {
    expect(maskPush(msg, { preset: 'off' }, 'en')).toBe(msg)
    expect(maskPush(msg, undefined, 'en')).toBe(msg)
    expect(maskPush(msg, { preset: 'hero' }, 'en')).toBe(msg)
  })

  it('masks title, body and non-routing data when the notifications surface is hidden', () => {
    const out = maskPush(msg, { preset: 'all' }, 'en')
    expect(JSON.stringify(out)).not.toContain('250')
    expect(out.data).toEqual({ route: '/flow' })
    expect(maskPush({ ...msg, data: undefined }, { preset: 'custom', notifications: true }, 'ar').body).toMatch(/[؀-ۿ]/)
  })

  it('fails closed when the settings could not be read', () => {
    const out = maskPush(msg, null, 'en')
    expect(JSON.stringify(out)).not.toContain('250')
  })
})
