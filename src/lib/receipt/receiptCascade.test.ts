import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Receipt } from '@/lib/store/types'

const deleteImage = vi.fn(async (_id: string) => {})
vi.mock('@/lib/native/receiptImages', () => ({ deleteReceiptImage: (id: string) => deleteImage(id) }))

import { dropExpenseReceipt, restoreExpenseReceipt } from './receiptCascade'

const receipt = { id: 'r1' } as Receipt

describe('receipt cascade', () => {
  beforeEach(() => { vi.useFakeTimers(); deleteImage.mockClear() })
  afterEach(() => vi.useRealTimers())

  it('deletes the row now and the photo after the undo window', () => {
    const del = vi.fn()
    dropExpenseReceipt('r1', [receipt], del)
    expect(del).toHaveBeenCalledWith('r1')
    expect(deleteImage).not.toHaveBeenCalled()
    vi.advanceTimersByTime(30_001)
    expect(deleteImage).toHaveBeenCalledWith('r1')
  })

  it('undo restores the row and keeps the photo', () => {
    dropExpenseReceipt('r1', [receipt], vi.fn())
    const back = vi.fn()
    restoreExpenseReceipt('r1', back)
    expect(back).toHaveBeenCalledWith(receipt)
    vi.advanceTimersByTime(20_000)
    expect(deleteImage).not.toHaveBeenCalled()
  })

  it('a late undo still restores the row, without the photo', () => {
    dropExpenseReceipt('r1', [receipt], vi.fn())
    vi.advanceTimersByTime(30_001)
    const back = vi.fn()
    expect(restoreExpenseReceipt('r1', back)).toBe(true)
    expect(back).toHaveBeenCalledWith(receipt)
  })

  it('reports false when nothing was held', () => {
    expect(restoreExpenseReceipt('missing', vi.fn())).toBe(false)
  })
})
