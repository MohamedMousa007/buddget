import { afterEach, describe, expect, it, vi } from 'vitest'
import { callGeminiResilient, clampGenerationConfig, MAX_OUTPUT_TOKENS_CAP, tapStreamUsage } from '@/lib/server/ai/gemini'

describe('clampGenerationConfig', () => {
  it('caps requested output tokens', () => {
    expect(clampGenerationConfig({ maxOutputTokens: 999_999 }).maxOutputTokens).toBe(MAX_OUTPUT_TOKENS_CAP)
  })

  it('defaults when none is requested', () => {
    expect(clampGenerationConfig(undefined).maxOutputTokens).toBe(2048)
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

  it('does not retry a request the model rejected', async () => {
    const fetchMock = vi.fn(async () => new Response('bad', { status: 400 }))
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const out = await callGeminiResilient(['model-a', 'model-b'], 'k', {})
    expect(out.res.status).toBe(400)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
