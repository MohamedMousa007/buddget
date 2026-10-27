import { describe, it, expect, vi, beforeEach } from 'vitest'

const generate = vi.fn()
vi.mock('@/lib/ai/generateWithFallback', () => ({
  generateWithFallback: (...a: unknown[]) => generate(...a),
  throwIfAiProxyNotOk: async (res: Response) => {
    if (!res.ok) throw new Error('proxy')
  },
}))

import { goalChatTurn, parseChatReply } from './goalChat'
import { averageMonthlySpend, fieldAdvice } from './fieldAdvice'

const now = new Date(2026, 9, 18)
const reply = (text: string) => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }) }) as unknown as Response
beforeEach(() => generate.mockReset())

describe('parseChatReply', () => {
  it('merges the draft over what was known', () => {
    const t = parseChatReply('{"reply":"Nice. About 38,000?","draft":{"category":"vacation","name":"Dahab","target":null,"date":"2027-08"},"chips":["Around 38,000","Higher","Lower","x"]}', { category: 'vacation', name: 'Trip', target: 30000 }, now)
    expect(t.draft).toEqual({ category: 'vacation', name: 'Dahab', target: 30000, date: '2027-08-01' })
    expect(t.chips).toEqual(['Around 38,000', 'Higher', 'Lower'])
  })
  it('ignores a past date and unknown categories, and needs a reply', () => {
    const t = parseChatReply('{"reply":"ok","draft":{"category":"zzz","date":"2020-01"}}', null, now)
    expect(t.draft).toMatchObject({ category: 'custom', date: undefined })
    expect(() => parseChatReply('{"draft":{}}', null, now)).toThrow()
    expect(() => parseChatReply('hello', null, now)).toThrow()
  })
})

describe('goalChatTurn', () => {
  it('sends the quick tier with no thinking, the history and the facts', async () => {
    generate.mockResolvedValue(reply('{"reply":"Got it","draft":{"name":"Car"},"chips":[]}'))
    const t = await goalChatTurn({ history: [{ role: 'user', text: 'a car' }, { role: 'buddgy', text: 'Which year?' }, { role: 'user', text: '2027' }], draft: null, currency: 'EGP', usualKeep: 3000, now })
    expect(t.reply).toBe('Got it')
    const body = generate.mock.calls[0][0]
    expect(body.tier).toBe('fast')
    expect(body.generationConfig.thinkingConfig.thinkingLevel).toBe('minimal')
    expect(body.contents.map((c: { role: string }) => c.role)).toEqual(['user', 'model', 'user'])
    expect(body.systemInstruction.parts[0].text).toContain('3000')
  })
})

describe('field advice', () => {
  it('suggests three months of spending for an emergency fund with no amount', () => {
    expect(fieldAdvice({ category: 'emergency_fund', target: 0, saved: 0, monthlySpendInCcy: 8120 })).toEqual({ kind: 'emergency', amount: 24400 })
    expect(fieldAdvice({ category: 'emergency_fund', target: 5000, saved: 0, monthlySpendInCcy: 8120 })).toBeNull()
    expect(fieldAdvice({ category: 'vacation', target: 0, saved: 0, monthlySpendInCcy: 8120 })).toBeNull()
  })
  it('notes when the goal is already covered', () => {
    expect(fieldAdvice({ category: 'car', target: 1000, saved: 1000, monthlySpendInCcy: null })).toEqual({ kind: 'covered' })
  })
  it('averages the last three full months of non-savings spend', () => {
    const e = (date: string, a: number, category = 'Food', currency: 'EGP' | 'USD' = 'EGP') => ({ date, category, amount: a, currency, amountInBaseCurrency: a })
    const rates = { USD_EGP: 50, EGP_USD: 0.02 }
    expect(averageMonthlySpend([e('2026-09-03', 3000), e('2026-08-03', 6000), e('2026-07-03', 9000), e('2026-09-04', 999, 'Savings'), e('2026-10-02', 5)], now, 'EGP', rates)).toBe(6000)
    expect(averageMonthlySpend([], now, 'EGP', rates)).toBeNull()
    // Live rates, not the stale cached base amount; spend-excluded rows stay out.
    const usd = { ...e('2026-09-03', 10, 'Food', 'USD'), amountInBaseCurrency: 10 }
    const excluded = { ...e('2026-09-05', 777), spendExclusion: 'method' as const }
    expect(averageMonthlySpend([usd, excluded], now, 'EGP', rates)).toBe(500)
  })
})
