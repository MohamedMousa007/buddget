import { EMPTY_USAGE, usageFromGemini, type TokenUsage } from '@/lib/server/ai/units'

/**
 * Buddgy's tiers. `fast` = quick capture, `smart` = chat and reasoning. Override per
 * environment with GEMINI_MODEL_FAST / GEMINI_MODEL_SMART / GEMINI_MODEL_LEGACY.
 */
export const LEGACY_MODEL = process.env.GEMINI_MODEL_LEGACY?.trim() || 'gemini-2.5-flash'

export const TIER_MODELS = {
  fast: process.env.GEMINI_MODEL_FAST?.trim() || 'gemini-2.5-flash-lite',
  smart: process.env.GEMINI_MODEL_SMART?.trim() || 'gemini-2.5-flash',
} as const
export type Tier = keyof typeof TIER_MODELS

const THINKING_BUDGET: Record<string, number> = { minimal: 0, low: 512, medium: 2048, high: 8192 }

/** Hard ceiling on output tokens any caller can request. */
export const MAX_OUTPUT_TOKENS_CAP = 8192

/** Overridable so tests and proxies can stand in for Google. */
const API_BASE = process.env.GEMINI_API_BASE?.trim().replace(/\/+$/, '') || 'https://generativelanguage.googleapis.com/v1beta'

export function geminiUrl(model: string, stream: boolean): string {
  const method = stream ? 'streamGenerateContent?alt=sse' : 'generateContent'
  return `${API_BASE}/models/${model}:${method}`
}

/** 2.x models speak `thinkingBudget`; 3.x speak `thinkingLevel`. */
export function configFor(model: string, config: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!model.startsWith('gemini-2.')) return config
  const thinking = config?.thinkingConfig as { thinkingLevel?: string } | undefined
  if (!thinking?.thinkingLevel) return config
  return { ...config, thinkingConfig: { thinkingBudget: THINKING_BUDGET[thinking.thinkingLevel] ?? 0 } }
}

const ALLOWED_CONFIG_KEYS = ['temperature', 'topP', 'topK', 'maxOutputTokens', 'responseMimeType', 'responseSchema', 'thinkingConfig', 'stopSequences', 'candidateCount']

export function clampGenerationConfig(config: Record<string, unknown> | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of ALLOWED_CONFIG_KEYS) if (config && key in config) out[key] = config[key]
  const requested = typeof out.maxOutputTokens === 'number' ? out.maxOutputTokens : 2048
  out.maxOutputTokens = Math.min(MAX_OUTPUT_TOKENS_CAP, Math.max(16, Math.floor(requested)))
  return out
}

export function callGemini(model: string, apiKey: string, body: Record<string, unknown>, stream: boolean, signal?: AbortSignal): Promise<Response> {
  return fetch(geminiUrl(model, stream), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({ ...body, generationConfig: configFor(model, body.generationConfig as Record<string, unknown> | undefined) }),
    signal,
  })
}

export function usageFromPayload(payload: unknown): TokenUsage {
  const meta = (payload as { usageMetadata?: Parameters<typeof usageFromGemini>[0] } | null)?.usageMetadata
  return usageFromGemini(meta)
}

/**
 * Passes an SSE body through untouched while remembering the last `usageMetadata` it carried,
 * so a streamed call can still be settled with its real cost.
 */
export function tapStreamUsage(
  body: ReadableStream<Uint8Array>,
  onDone: (usage: TokenUsage, completed: boolean) => void | Promise<void>,
): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder()
  let tail = ''
  let usage = EMPTY_USAGE
  let finished = false
  const finish = async (completed: boolean) => {
    if (finished) return
    finished = true
    await onDone(usage, completed)
  }
  const scan = (text: string) => {
    tail += text
    const lines = tail.split('\n')
    tail = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith('data:')) continue
      try {
        const found = usageFromPayload(JSON.parse(line.slice(5).trim()))
        if (found.promptTokens > 0 || found.outputTokens > 0) usage = found
      } catch {
        // partial or non-JSON frames carry no usage
      }
    }
  }
  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        scan(decoder.decode(chunk, { stream: true }))
        controller.enqueue(chunk)
      },
      async flush() {
        scan('\n')
        await finish(true)
      },
      cancel() {
        void finish(false)
      },
    } as Transformer<Uint8Array, Uint8Array>),
  )
}
