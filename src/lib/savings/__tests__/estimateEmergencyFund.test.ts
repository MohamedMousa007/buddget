import { describe, it, expect } from 'vitest'
import { parseEmergencyEstimate } from '@/lib/savings/estimateEmergencyFund'

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
