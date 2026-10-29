import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ fetch: vi.fn(), lang: 'en' }))
vi.mock('@/lib/apiBase', () => ({ apiFetchAuth: h.fetch }))
vi.mock('@/lib/store/useFinanceStore', () => ({ useFinanceStore: { getState: () => ({ settings: { language: h.lang } }) } }))

import { generateWithFallback, throwIfAiProxyNotOk } from './generateWithFallback'
import { quotaDeniedMessage } from './quotaDeniedCopy'

const denied = (layer = 'window_5h', resetAt: string | null = null) =>
  new Response(JSON.stringify({ error: 'ai_quota', layer, resetAt, stage: 'quota' }), { status: layer === 'feature_disabled' ? 403 : 429 })

beforeEach(() => {
  h.fetch.mockReset()
  h.lang = 'en'
})

describe('quota-denied responses', () => {
  it('are not retried', async () => {
    h.fetch.mockImplementation(async () => denied())
    await generateWithFallback({ contents: [] }, { backoffMs: 0 })
    expect(h.fetch).toHaveBeenCalledTimes(1)
  })

  it('still retry a plain 429', async () => {
    h.fetch.mockImplementation(async () => new Response('{}', { status: 429 }))
    await generateWithFallback({ contents: [] }, { backoffMs: 0 })
    expect(h.fetch).toHaveBeenCalledTimes(3)
  })

  it('show the quota copy, never the Gemini key message', async () => {
    await expect(throwIfAiProxyNotOk(denied())).rejects.toThrow(/limit/i)
    await expect(throwIfAiProxyNotOk(denied())).rejects.not.toThrow(/Google|API key/)
  })

  it('show the plan copy when the feature is off, and Arabic in an Arabic app', async () => {
    h.lang = 'ar'
    await expect(throwIfAiProxyNotOk(denied('feature_disabled'))).rejects.toThrow(/[؀-ۿ]/)
  })
})

describe('quotaDeniedMessage', () => {
  it('names the reset time when known', () => {
    const msg = quotaDeniedMessage('window_5h', new Date(Date.now() + 2 * 3600_000).toISOString(), 'en')
    expect(msg).toMatch(/reset/i)
  })
})
