import { describe, it, expect, afterEach } from 'vitest'
import { registerBackGuard, runBackGuards } from '@/lib/navigation/backGuard'

/**
 * `registerBackGuard` returns its own disposer and `runBackGuards` does NOT
 * unregister anything, so tests must track disposers rather than trying to
 * "drain" the stack by running it.
 */
const disposers: (() => void)[] = []
function register(fn: () => boolean) {
  const dispose = registerBackGuard(fn)
  disposers.push(dispose)
  return dispose
}

/**
 * The Android hardware-back contract.
 *
 * Nine overlays bypass ModalShell for layout reasons and register this guard
 * themselves (via `useDismissable`). If any of the behaviour below regresses,
 * the back button stops closing the top sheet and closes the whole screen
 * instead — which is exactly the bug these tests exist to prevent.
 */
describe('backGuard', () => {
  afterEach(() => {
    disposers.splice(0).forEach((d) => d())
  })

  it('reports unhandled when nothing is registered, so navigation proceeds', () => {
    expect(runBackGuards()).toBe(false)
  })

  it('lets a guard consume the press', () => {
    let closed = false
    register(() => { closed = true; return true })
    expect(runBackGuards()).toBe(true)
    expect(closed).toBe(true)
  })

  it('runs LIFO, so only the TOPMOST overlay closes', () => {
    const order: string[] = []
    register(() => { order.push('under'); return true })
    const closeOver = register(() => { order.push('over'); return true })

    runBackGuards()
    // The nested sheet consumes the press; the one beneath must stay open.
    expect(order).toEqual(['over'])

    // A guard is not removed by running — the overlay unregisters when it
    // actually unmounts. Only then does the next press reach the one beneath.
    closeOver()
    runBackGuards()
    expect(order).toEqual(['over', 'under'])
  })

  it('falls through to the next guard when one declines', () => {
    const seen: string[] = []
    register(() => { seen.push('handler'); return true })
    register(() => { seen.push('decliner'); return false })

    expect(runBackGuards()).toBe(true)
    expect(seen).toEqual(['decliner', 'handler'])
  })

  it('unregisters on cleanup, so a closed sheet stops swallowing back presses', () => {
    const dispose = register(() => true)
    expect(runBackGuards()).toBe(true)
    dispose()
    expect(runBackGuards()).toBe(false)
  })

  it('unregisters the right guard when overlays close out of order', () => {
    const seen: string[] = []
    const disposeA = register(() => { seen.push('a'); return true })
    register(() => { seen.push('b'); return true })

    // The lower sheet closes first (e.g. its data loaded away) while the upper
    // one is still open — removing by identity, not by position.
    disposeA()

    // 'a' must never run again, however many presses arrive; 'b' keeps handling
    // them because it is still mounted.
    runBackGuards()
    runBackGuards()
    expect(seen).toEqual(['b', 'b'])
    expect(seen).not.toContain('a')
  })
})
