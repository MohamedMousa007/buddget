import { describe, it, expect, vi, beforeEach } from 'vitest'

const generate = vi.fn()
vi.mock('@/lib/ai/generateWithFallback', () => ({
  generateWithFallback: (...a: unknown[]) => generate(...a),
  throwIfAiProxyNotOk: async (res: Response) => {
    if (!res.ok) throw new Error('proxy')
  },
}))

import { estimateGoalCost, parseGoalText } from './goalAi'

const reply = (text: string, ok = true) =>
  ({ ok, json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }) }) as unknown as Response

beforeEach(() => generate.mockReset())

describe('goal AI calls', () => {
  it('parse: sends the fast tier with the text and returns the parsed goal', async () => {
    generate.mockResolvedValue(reply('{"category":"vacation","name":"Dahab","target":38000,"date":"2027-08"}'))
    const g = await parseGoalText('A week in Dahab next summer', { currency: 'EGP', now: new Date(2026, 9, 18) })
    expect(g).toMatchObject({ category: 'vacation', name: 'Dahab', target: 38000, date: '2027-08-01' })
    const body = generate.mock.calls[0][0]
    expect(body.tier).toBe('fast')
    expect(body.contents[0].parts[0].text).toContain('A week in Dahab next summer')
  })
  it('parse: a proxy failure or unreadable reply rejects so the UI can fall back', async () => {
    generate.mockResolvedValue(reply('', false))
    await expect(parseGoalText('x', { currency: 'EGP', now: new Date() })).rejects.toThrow()
    generate.mockResolvedValue(reply('sorry, no'))
    await expect(parseGoalText('x', { currency: 'EGP', now: new Date() })).rejects.toThrow()
  })
  it('cost: asks for grounded prices and returns up to three options', async () => {
    generate.mockResolvedValue(reply('{"options":[{"label":"Camp","amount":30000},{"label":"Hotel","amount":38000}],"assumption":"Two people"}'))
    const c = await estimateGoalCost({ name: 'Dahab', category: 'Vacation', currency: 'EGP', country: 'Egypt' })
    expect(c.options).toHaveLength(2)
    expect(generate.mock.calls[0][0].grounded).toBe(true)
    expect(generate.mock.calls[0][0].contents[0].parts[0].text).toContain('in Egypt')
  })
  it('cost: an empty estimate rejects', async () => {
    generate.mockResolvedValue(reply('{"options":[]}'))
    await expect(estimateGoalCost({ name: 'x', category: 'y', currency: 'EGP' })).rejects.toThrow()
  })
})
