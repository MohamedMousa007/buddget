import { describe, expect, it } from 'vitest'
import { clampGenerationConfig, MAX_OUTPUT_TOKENS_CAP, tapStreamUsage } from '@/lib/server/ai/gemini'

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
