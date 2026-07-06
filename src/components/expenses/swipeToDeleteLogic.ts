// Pure, DOM-free snap math for swipe-to-delete. Kept separate from the React
// component so it is unit-testable in the node vitest env.

export const REVEAL = 88 // px the row slides left to expose the delete action
const SNAP = REVEAL / 2 // past-halfway commits to open
const FLING = 400 // px/s: a fast flick overrides position

/**
 * Given the row's absolute x at drag end (0 = closed, -REVEAL = open) and the
 * horizontal velocity, return the position to settle to (0 or -REVEAL).
 */
export function resolveSwipe(x: number, velocity: number): number {
  if (velocity < -FLING) return -REVEAL // fast flick left → open
  if (velocity > FLING) return 0 // fast flick right → close
  return x <= -SNAP ? -REVEAL : 0 // otherwise snap to nearest
}
