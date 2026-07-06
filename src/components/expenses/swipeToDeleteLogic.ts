// Pure, DOM-free snap math for swipe-to-delete. Kept separate from the React
// component so it is unit-testable in the node vitest env.

export const REVEAL = 120 // px the row slides to expose the delete action (either direction)
const SNAP = REVEAL * 0.7 // requires a deliberate, deep swipe before committing
const FLING = 500 // px/s: a fast flick overrides position

/**
 * Given the row's absolute x at drag end (0 = closed, ±REVEAL = open toward
 * that side) and the horizontal velocity, return the position to settle to:
 * -REVEAL (delete revealed on the end/trailing side), +REVEAL (start/leading
 * side), or 0 (closed).
 */
export function resolveSwipe(x: number, velocity: number): number {
  if (velocity < -FLING) return -REVEAL // fast flick left → open end-side
  if (velocity > FLING) return REVEAL // fast flick right → open start-side
  if (x <= -SNAP) return -REVEAL
  if (x >= SNAP) return REVEAL
  return 0
}
