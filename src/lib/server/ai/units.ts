/** Fresh input = 1 unit/token, cached input = 0.1, output (incl. thinking) = 4. */
export const CACHED_INPUT_WEIGHT = 0.1
export const OUTPUT_WEIGHT = 4

export interface TokenUsage {
  promptTokens: number
  cachedTokens: number
  outputTokens: number
}

export const EMPTY_USAGE: TokenUsage = { promptTokens: 0, cachedTokens: 0, outputTokens: 0 }

export function computeUnits(u: TokenUsage): number {
  const cached = Math.min(u.cachedTokens, u.promptTokens)
  const fresh = u.promptTokens - cached
  return Math.round(fresh + cached * CACHED_INPUT_WEIGHT + u.outputTokens * OUTPUT_WEIGHT)
}

export function addUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    promptTokens: a.promptTokens + b.promptTokens,
    cachedTokens: a.cachedTokens + b.cachedTokens,
    outputTokens: a.outputTokens + b.outputTokens,
  }
}

interface GeminiUsageMetadata {
  promptTokenCount?: number
  cachedContentTokenCount?: number
  candidatesTokenCount?: number
  thoughtsTokenCount?: number
}

/** Thinking tokens are billed as output, so they count as output. */
export function usageFromGemini(meta: GeminiUsageMetadata | undefined | null): TokenUsage {
  if (!meta) return EMPTY_USAGE
  return {
    promptTokens: meta.promptTokenCount ?? 0,
    cachedTokens: meta.cachedContentTokenCount ?? 0,
    outputTokens: (meta.candidatesTokenCount ?? 0) + (meta.thoughtsTokenCount ?? 0),
  }
}

/** Rough pre-call estimate used to reserve quota: ~4 chars per token in, plus the output cap. */
export function estimateUnits(inputChars: number, maxOutputTokens: number): number {
  return Math.ceil(inputChars / 4) + maxOutputTokens * OUTPUT_WEIGHT
}

/** Whisper is billed per second of audio (about $0.11 an hour), roughly 100 units a second on this scale. */
export const AUDIO_UNITS_PER_SECOND = 100
/** Compressed speech (webm/opus, mp4/aac) runs near 32 kbps; used only when the provider reports no duration. */
export const AUDIO_BYTES_PER_SECOND = 4000

/** Units for a clip: the provider's reported seconds when usable, else seconds estimated from its size in bytes. */
export function audioUnits(seconds: number | undefined, bytes = 0): number {
  const s = typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0 ? seconds : bytes / AUDIO_BYTES_PER_SECOND
  return Math.ceil(s * AUDIO_UNITS_PER_SECOND)
}

/** Seconds billed for a clip: the provider's reported duration when usable, else estimated from its size. Priced per second from the price book. */
export function audioSeconds(seconds: number | undefined, bytes = 0): number {
  const s = typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0 ? seconds : bytes / AUDIO_BYTES_PER_SECOND
  return Math.ceil(s)
}
