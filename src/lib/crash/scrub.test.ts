import { describe, expect, it } from 'vitest'
import type { ErrorEvent } from '@sentry/react'
import { scrubBreadcrumb, scrubEvent, scrubText } from './scrub'

describe('scrubText', () => {
  it('removes tokens, emails, amounts, phone numbers and key query params', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVPmB92K27uhbUJU1p1r'
    expect(scrubText(`bad ${jwt}`)).toBe('bad [token]')
    expect(scrubText('mail m.mousaofficial@gmail.com now')).toBe('mail [email] now')
    expect(scrubText('spent 1,250.50 EGP at a shop')).toBe('spent [amount] at a shop')
    expect(scrubText('balance USD 300 left')).toBe('balance [amount] left')
    expect(scrubText('call +20 100 123 4567 please')).toBe('call [number] please')
    expect(scrubText('https://x.supabase.co/rest?apikey=abc123&select=*')).toBe('https://x.supabase.co/rest?apikey=[redacted]&select=*')
  })

  it('keeps ordinary stack text', () => {
    expect(scrubText('TypeError: undefined is not an object (evaluating "a.b")')).toBe('TypeError: undefined is not an object (evaluating "a.b")')
  })
})

describe('scrubEvent', () => {
  it('strips user pii, request bodies and console breadcrumbs', () => {
    const event = {
      message: 'failed for a@b.co',
      user: { id: 'u1', email: 'a@b.co', ip_address: '1.2.3.4' },
      request: { url: 'https://app/x?token=abc', headers: { authorization: 'Bearer x' }, data: { amount: 5 } },
      extra: { body: 'Your balance is 500 EGP', note: 'ok' },
      breadcrumbs: [{ category: 'console', message: 'secret 500 EGP' }, { category: 'navigation', message: '/accounts' }],
    } as unknown as ErrorEvent
    const out = scrubEvent(event)
    expect(out.message).toBe('failed for [email]')
    expect(out.user).toEqual({ id: 'u1' })
    expect(out.request?.url).toBe('https://app/x')
    expect(out.request?.headers).toBeUndefined()
    expect(out.request?.data).toBeUndefined()
    expect(out.extra).toEqual({ body: '[redacted]', note: 'ok' })
    expect(out.breadcrumbs).toEqual([{ category: 'navigation', message: '/accounts', data: undefined }])
  })
})

describe('scrubBreadcrumb', () => {
  it('drops input breadcrumbs', () => {
    expect(scrubBreadcrumb({ category: 'ui.input', message: 'typed' })).toBeNull()
  })
})
