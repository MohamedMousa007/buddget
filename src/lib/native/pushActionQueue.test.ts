import { beforeEach, describe, expect, it, vi } from 'vitest'
import { __resetPushActionQueue, enqueuePushAction, subscribePushActions } from './pushActionQueue'

describe('pushActionQueue', () => {
  beforeEach(() => __resetPushActionQueue())

  it('holds a tap that arrives before any handler exists and replays it on subscribe', () => {
    enqueuePushAction({ id: 1 })
    const h = vi.fn()
    subscribePushActions(h)
    expect(h).toHaveBeenCalledTimes(1)
    expect(h).toHaveBeenCalledWith({ id: 1 })
  })

  it('delivers live taps once and does not replay them to a later subscriber', () => {
    const a = vi.fn()
    const off = subscribePushActions(a)
    enqueuePushAction({ id: 2 })
    expect(a).toHaveBeenCalledTimes(1)
    off()
    const b = vi.fn()
    subscribePushActions(b)
    expect(b).not.toHaveBeenCalled()
  })
})
