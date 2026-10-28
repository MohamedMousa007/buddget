import { describe, expect, it } from 'vitest'
import { MAX_TOASTS, pushToast, toastDuration, type ToastItem } from './toastQueue'

const t = (id: number, undo = false): ToastItem => ({ id, message: String(id), undo: undo ? () => {} : undefined })

describe('toastQueue', () => {
  it('keeps more than one toast', () => {
    expect(pushToast([t(1, true)], t(2, true)).map((x) => x.id)).toEqual([1, 2])
  })
  it('over the cap drops a plain toast before an Undo toast', () => {
    const list = [t(1, true), t(2), t(3, true)]
    expect(pushToast(list, t(4, true)).map((x) => x.id)).toEqual([1, 3, 4])
    expect(pushToast(list, t(4, true))).toHaveLength(MAX_TOASTS)
  })
  it('gives Undo toasts longer', () => {
    expect(toastDuration(true)).toBeGreaterThan(toastDuration(false))
    expect(toastDuration(true)).toBeGreaterThanOrEqual(8000)
  })
})
