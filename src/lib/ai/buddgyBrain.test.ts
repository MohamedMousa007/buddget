import { describe, it, expect } from 'vitest'
import type { FinanceStore } from '@/lib/store/types'
import { partialMessage, readGeminiText } from '@/lib/ai/geminiStream'
import { runLookup } from '@/lib/ai/buddgyLookup'
import { buildMemoryBlock } from '@/lib/ai/buddgyMemory'
import { thinkingFor } from '@/lib/ai/runAiCommand'

const today = new Date().toISOString().slice(0, 10)
const exp = (id: string, date: string, description: string, category: string, amount: number, pm = 'pm-cash') => ({
  id, date, description, category, amount, currency: 'AED', amountInBaseCurrency: amount, paymentMethodId: pm, isRecurring: false,
})
const store = {
  settings: { baseCurrency: 'AED' },
  exchangeRates: {},
  paymentMethods: [{ id: 'pm-cash', name: 'Cash' }, { id: 'pm-visa', name: 'ADCB Visa' }],
  expenses: [
    exp('1', '2026-08-03', 'Talabat order', 'Food', 80, 'pm-visa'),
    exp('2', '2026-08-20', 'talabat', 'Food', 120, 'pm-visa'),
    exp('3', '2026-09-02', 'Careem ride', 'Transport', 40),
    { ...exp('4', '2026-09-05', 'Refunded shoes', 'Enjoyment', 300), refundKind: 'refunded' },
    exp('5', today, 'Talabat', 'Food', 55, 'pm-visa'),
    exp('6', today, 'Talabat dinner', 'Food', 65, 'pm-visa'),
  ],
  incomeEvents: [],
  subscriptions: [],
  incomeSources: [{ name: 'Salary', isRecurring: true, dayOfMonth: 25 }],
} as unknown as FinanceStore

describe('partialMessage', () => {
  it('decodes the message as far as it has streamed', () => {
    expect(partialMessage('{"mood":"happy","mess')).toBeNull()
    expect(partialMessage('{"mood":"happy","message":"You spent AED 1')).toBe('You spent AED 1')
    expect(partialMessage('{"message":"Line one\\nLine \\"two\\"","action"')).toBe('Line one\nLine "two"')
    // A half-arrived escape is held back rather than shown broken.
    expect(partialMessage('{"message":"caf\\u00')).toBe('caf')
  })
})

describe('readGeminiText', () => {
  it('assembles SSE chunks, skips thought parts, reports partial messages', async () => {
    const chunk = (text: string, thought = false) =>
      `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text, thought }] } }] })}\n\n`
    const parts = [chunk('reasoning…', true), chunk('{"message":"Hel'), chunk('lo","action":"query","data":{}}')]
    const enc = new TextEncoder()
    const body = new ReadableStream({
      start(c) {
        parts.forEach((p) => c.enqueue(enc.encode(p)))
        c.close()
      },
    })
    const seen: string[] = []
    const text = await readGeminiText(new Response(body), (m) => seen.push(m))
    expect(JSON.parse(text).message).toBe('Hello')
    expect(seen).toEqual(['Hel', 'Hello'])
  })
})

describe('runLookup', () => {
  it('filters by merchant and range, excludes refunds, groups by month', () => {
    const out = runLookup(store, { kind: 'expenses', from: '2026-08-01', to: '2026-08-31', text: 'talabat', groupBy: 'month' })
    expect(out).toContain('2 items, total AED 200')
    expect(out).toContain('- 2026-08: AED 200 (2)')
    expect(runLookup(store, { from: '2026-09-01', to: '2026-09-30', category: 'Enjoyment' })).toContain('No expenses match')
  })
  it('filters by payment method name', () => {
    expect(runLookup(store, { paymentMethod: 'cash', groupBy: 'none' })).toContain('1 items, total AED 40')
  })
})

it('memory learns usual card, merchant categories and paydays', () => {
  const block = buildMemoryBlock(store, ['Saving for a wedding'])
  expect(block).toContain('Usually pays with: ADCB Visa')
  expect(block).toContain('talabat → Food')
  expect(block).toContain('Salary on day 25')
  expect(block).toContain('Remembered: Saving for a wedding')
})

it('thinks only as hard as the request needs', () => {
  expect(thinkingFor('coffee 15 cash')).toBe('minimal')
  expect(thinkingFor('how much did I spend on food?')).toBe('low')
  expect(thinkingFor('build me a budget for next month')).toBe('medium')
})
