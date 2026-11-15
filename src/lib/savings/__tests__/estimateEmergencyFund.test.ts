import { describe, it, expect, vi } from 'vitest'

const generate = vi.fn()
vi.mock('@/lib/ai/generateWithFallback', () => ({
  generateWithFallback: (...a: unknown[]) => generate(...a),
  throwIfAiProxyNotOk: async () => undefined,
}))

import { estimateEmergencyFund, parseEmergencyEstimate } from '@/lib/savings/estimateEmergencyFund'

describe('parseEmergencyEstimate', () => {
  it('extracts JSON from a prose-wrapped grounded reply and rounds', () => {
    const text = 'Based on current data:\n```json\n{"monthlyEssentials": 8450.7, "targetMonths": 4, "rationale": "Modest Cairo household."}\n```\nHope this helps!'
    expect(parseEmergencyEstimate(text)).toEqual({ monthlyEssentials: 8451, targetMonths: 4, rationale: 'Modest Cairo household.' })
  })

  it('clamps targetMonths to 3–6', () => {
    expect(parseEmergencyEstimate('{"monthlyEssentials": 5000, "targetMonths": 12}').targetMonths).toBe(6)
    expect(parseEmergencyEstimate('{"monthlyEssentials": 5000, "targetMonths": 1}').targetMonths).toBe(3)
    expect(parseEmergencyEstimate('{"monthlyEssentials": 5000}').targetMonths).toBe(3) // missing → default 3
  })

  it('rejects a reply with no JSON or a non-positive amount', () => {
    expect(() => parseEmergencyEstimate('sorry, I cannot help')).toThrow()
    expect(() => parseEmergencyEstimate('{"monthlyEssentials": 0, "targetMonths": 3}')).toThrow()
  })
})

describe('estimateEmergencyFund', () => {
  const reply = (headers: Record<string, string>) =>
    ({ ok: true, headers: new Headers(headers), json: async () => ({ candidates: [{ content: { parts: [{ text: '{"monthlyEssentials": 5000, "targetMonths": 3}' }] } }] }) }) as unknown as Response

  it('flags an estimate made without live prices when the search allowance was spent', async () => {
    generate.mockResolvedValue(reply({ 'x-grounding': 'limited' }))
    expect((await estimateEmergencyFund({ currency: 'EGP' })).groundingLimited).toBe(true)
    generate.mockResolvedValue(reply({}))
    expect((await estimateEmergencyFund({ currency: 'EGP' })).groundingLimited).toBeUndefined()
  })
})
