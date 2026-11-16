import { afterEach, describe, expect, it, vi } from 'vitest'
import { callGeminiResilient, clampGenerationConfig, configFor, MAX_OUTPUT_TOKENS_CAP, MAX_THINKING_BUDGET, tapStreamUsage } from '@/lib/server/ai/gemini'

describe('clampGenerationConfig', () => {
  it('caps requested output tokens', () => {
    expect(clampGenerationConfig({ maxOutputTokens: 999_999 }).maxOutputTokens).toBe(MAX_OUTPUT_TOKENS_CAP)
  })

  it('defaults when none is requested', () => {
    expect(clampGenerationConfig(undefined).maxOutputTokens).toBe(2048)
  })

  it('drops keys outside the pinned list, including candidateCount', () => {
    const out = clampGenerationConfig({ candidateCount: 8, presencePenalty: 2, temperature: 0.2 })
    expect(out).not.toHaveProperty('candidateCount')
    expect(out).not.toHaveProperty('presencePenalty')
    expect(out.temperature).toBe(0.2)
  })

  it('caps the thinking budget and pins thinkingConfig to its known keys', () => {
    expect(clampGenerationConfig({ thinkingConfig: { thinkingBudget: 99_999, includeThoughts: true } }).thinkingConfig).toEqual({ thinkingBudget: MAX_THINKING_BUDGET })
    expect(clampGenerationConfig({ thinkingConfig: { thinkingLevel: 'medium' } }).thinkingConfig).toEqual({ thinkingLevel: 'medium' })
    expect(clampGenerationConfig({ thinkingConfig: { thinkingLevel: 'high' } })).not.toHaveProperty('thinkingConfig')
    expect(clampGenerationConfig({ thinkingConfig: { thinkingLevel: 'nonsense' } })).not.toHaveProperty('thinkingConfig')
  })
})

describe('tapStreamUsage', () => {
  it('passes bytes through and reports the last usage', async () => {
    const frames = [
      'data: {"candidates":[{"content":{"parts":[{"text":"hi"}]}}]}\n\n',
      'data: {"usageMetadata":{"promptTokenCount":40,"cachedContentTokenCount":8,"candidatesTokenCount":5}}\n\n',
    ]
    const enc = new TextEncoder()
    const src = new ReadableStream<Uint8Array>({
      start(c) {
        for (const f of frames) c.enqueue(enc.encode(f))
        c.close()
      },
    })
    let reported: { usage: unknown; completed: boolean } | null = null
    const out = tapStreamUsage(src, (usage, completed) => {
      reported = { usage, completed }
    })
    const text = await new Response(out).text()
    expect(text).toBe(frames.join(''))
    expect(reported).toEqual({ usage: { promptTokens: 40, cachedTokens: 8, outputTokens: 5 }, completed: true })
  })
})

describe('callGeminiResilient', () => {
  afterEach(() => vi.unstubAllGlobals())
  const ok = () => new Response('data: {}\n\n', { status: 200 })

  it('retries the primary once, then falls back to the other model', async () => {
    const urls: string[] = []
    const fetchMock = vi.fn(async (url: string) => {
      urls.push(url)
      return urls.length < 3 ? new Response('overloaded', { status: 503 }) : ok()
    })
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const out = await callGeminiResilient(['model-a', 'model-b'], 'k', {})
    expect(out.model).toBe('model-b')
    expect(urls.map((u) => (u.includes('model-a') ? 'a' : 'b')).join('')).toBe('aab')
  })

  it('moves straight to the other model when the primary is retired (404)', async () => {
    const urls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      urls.push(url)
      return url.includes('model-a') ? new Response('gone', { status: 404 }) : ok()
    }))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const out = await callGeminiResilient(['model-a', 'model-b'], 'k', {})
    expect(out.model).toBe('model-b')
    expect(urls.map((u) => (u.includes('model-a') ? 'a' : 'b')).join('')).toBe('ab')
  })

  it('does not retry a request the model rejected', async () => {
    const fetchMock = vi.fn(async () => new Response('bad', { status: 400 }))
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const out = await callGeminiResilient(['model-a', 'model-b'], 'k', {})
    expect(out.res.status).toBe(400)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('configFor', () => {
  it('turns a thinking budget into a level for 3.x models and leaves 2.x alone', () => {
    expect(configFor('gemini-3.5-flash-lite', { thinkingConfig: { thinkingBudget: 0 } })).toEqual({ thinkingConfig: { thinkingLevel: 'minimal' } })
    expect(configFor('gemini-3.5-flash-lite', { thinkingConfig: { thinkingBudget: 1024 } })).toEqual({ thinkingConfig: { thinkingLevel: 'medium' } })
    expect(configFor('gemini-2.5-flash', { thinkingConfig: { thinkingBudget: 0 } })).toEqual({ thinkingConfig: { thinkingBudget: 0 } })
  })
})
