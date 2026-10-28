import { describe, it, expect } from 'vitest'
import { renderServerCopy } from '@/lib/notifications/serverCopy'
import { getServerDictionary } from '@/lib/i18n/getServerDictionary'

const AR = /[؀-ۿ]/

describe('renderServerCopy', () => {
  it('renders Arabic for ar users and English otherwise', () => {
    const args = { kind: 'carry', amount: 1234, currency: 'EGP' } as const
    const ar = renderServerCopy(getServerDictionary('ar'), args)
    const en = renderServerCopy(getServerDictionary('en'), args)
    const fallback = renderServerCopy(getServerDictionary(null), args)
    expect(ar.title).toMatch(AR)
    expect(ar.body).toContain('1,234')
    expect(en.title).toBe('Money moved to savings')
    expect(fallback).toEqual(en)
  })

  it('covers device and support copy in Arabic', () => {
    const d = getServerDictionary('ar')
    for (const a of [
      { kind: 'device_none', cause: 'removed' },
      { kind: 'device_main', deviceName: 'iPhone', cause: 'stale' },
      { kind: 'device_joined', deviceName: 'Pixel' },
      { kind: 'support_resolved', subject: 'Login', number: 7 },
    ] as const) {
      const r = renderServerCopy(d, a)
      expect(r.title + r.body).toMatch(AR)
    }
  })

  it('keeps the device name and ticket number in the text', () => {
    const d = getServerDictionary('ar')
    expect(renderServerCopy(d, { kind: 'device_joined', deviceName: 'Pixel' }).body).toContain('Pixel')
    expect(renderServerCopy(d, { kind: 'support_resolved', subject: 'Login', number: 7 }).body).toContain('7')
  })
})
