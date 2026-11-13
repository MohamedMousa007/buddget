/**
 * Held messages were held for a reason. These pin the rules that keep "Select all ready" from writing wrong ledger
 * entries: only a plain debit with nothing created is ready; credits, currency-only rows and unverified senders never are.
 */
import { describe, it, expect } from 'vitest'
import { dismissKind, dismissNeedsUndo, groupHeld, heldGroup, runBatch } from '@/lib/sms/heldReview'

const row = (over: Partial<Parameters<typeof heldGroup>[0]> = {}) => ({ kind: 'expense', failure_code: 'insert_failed', expense_id: null, income_id: null, ...over })

describe('heldGroup', () => {
  it('a plain debit nothing was created for is ready', () => {
    expect(heldGroup(row())).toBe('ready')
  })
  it('a credit needs a look, even when it would link to a payday', () => {
    expect(heldGroup(row({ kind: 'income' }))).toBe('check')
    expect(heldGroup(row({ kind: 'instant_transfer_in' }))).toBe('check')
    expect(heldGroup(row({ kind: 'refund' }))).toBe('check')
  })
  it('a row whose transaction already exists (currency still to confirm) needs a look', () => {
    expect(heldGroup(row({ failure_code: 'currency_provisional', expense_id: 'e1' }))).toBe('check')
    expect(heldGroup(row({ failure_code: 'currency_provisional', income_id: 'i1', kind: 'income' }))).toBe('check')
  })
  it('an unverified sender is locked, whatever else it is', () => {
    expect(heldGroup(row({ failure_code: 'sender_mismatch', kind: 'income' }))).toBe('locked')
    expect(heldGroup(row({ failure_code: 'sender_mismatch' }))).toBe('locked')
  })
  it('groups a mixed list without losing or duplicating rows', () => {
    const items = [row(), row({ kind: 'income' }), row({ failure_code: 'sender_mismatch' }), row({ expense_id: 'e1', failure_code: 'currency_provisional' }), row()]
    const g = groupHeld(items)
    expect(g.ready).toHaveLength(2)
    expect(g.check).toHaveLength(2)
    expect(g.locked).toHaveLength(1)
    expect(g.ready.length + g.check.length + g.locked.length).toBe(items.length)
  })
})

describe('dismissKind', () => {
  it('names what dismissing does to the selected rows', () => {
    expect(dismissKind([row({ expense_id: 'e1' }), row({ income_id: 'i1' })])).toBe('keepAsIs')
    expect(dismissKind([row(), row()])).toBe('dontAdd')
    expect(dismissKind([row(), row({ expense_id: 'e1' })])).toBe('dismiss')
    expect(dismissKind([])).toBe('dismiss')
  })
  it('only a message that was never created has something to undo', () => {
    expect(dismissNeedsUndo([row()])).toBe(true)
    expect(dismissNeedsUndo([row({ expense_id: 'e1' })])).toBe(false)
    expect(dismissNeedsUndo([row({ expense_id: 'e1' }), row()])).toBe(true)
  })
})

describe('runBatch', () => {
  it('keeps going after a failure and reports each id once', async () => {
    const seen: string[] = []
    const res = await runBatch(['a', 'b', 'c', 'd'], async (id) => {
      seen.push(id)
      if (id === 'b') return false
      if (id === 'c') throw new Error('network')
      return true
    })
    expect(seen).toEqual(['a', 'b', 'c', 'd'])
    expect(res).toEqual({ ok: ['a', 'd'], failed: ['b', 'c'] })
  })
  it('runs one at a time, in order', async () => {
    let running = 0
    let max = 0
    await runBatch(['1', '2', '3'], async () => {
      running++
      max = Math.max(max, running)
      await Promise.resolve()
      running--
      return true
    })
    expect(max).toBe(1)
  })
  it('an empty selection runs nothing', async () => {
    expect(await runBatch([], async () => true)).toEqual({ ok: [], failed: [] })
  })
})

import { vi } from 'vitest'
import { createDeferred } from '@/lib/sms/heldReview'

describe('createDeferred (the Undo window for "Don’t add")', () => {
  it('sends the call after the window', async () => {
    vi.useFakeTimers()
    const run = vi.fn(async () => {})
    const d = createDeferred(run, 8000)
    d.schedule(['a', 'b'])
    await vi.advanceTimersByTimeAsync(7999)
    expect(run).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(2)
    expect(run).toHaveBeenCalledWith(['a', 'b'])
    vi.useRealTimers()
  })
  it('Undo inside the window means nothing is ever sent', async () => {
    vi.useFakeTimers()
    const run = vi.fn(async () => {})
    const d = createDeferred(run, 8000)
    const h = d.schedule(['a'])
    expect(h.cancel()).toBe(true)
    await vi.advanceTimersByTimeAsync(20000)
    expect(run).not.toHaveBeenCalled()
    vi.useRealTimers()
  })
  it('Undo after the call was sent reports that it was too late', async () => {
    vi.useFakeTimers()
    const d = createDeferred(async () => {}, 1000)
    const h = d.schedule(['a'])
    await vi.advanceTimersByTimeAsync(1500)
    expect(h.cancel()).toBe(false)
    vi.useRealTimers()
  })
  it('flush sends everything waiting at once, exactly once', async () => {
    vi.useFakeTimers()
    const run = vi.fn(async () => {})
    const d = createDeferred(run, 8000)
    d.schedule(['a'])
    d.schedule(['b'])
    await d.flush()
    expect(run).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(20000)
    expect(run).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })
})
