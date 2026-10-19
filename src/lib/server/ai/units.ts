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
