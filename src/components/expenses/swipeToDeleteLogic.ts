// Pure, DOM-free snap math for swipe-to-delete. Kept separate from the React
// component so it is unit-testable in the node vitest env.

export const REVEAL = 112 // px the row slides left to expose the Delete button (open resting offset)
export const OPEN_AT = 150 // px of leftward travel required to commit to open (≈ mid-card, deliberate)

/**
 * Given the row's absolute x at drag end (0 = closed, negative = swiped left),
 * return whether the release should open the Delete button. One-direction only
 * (leftward) and position-based — velocity is intentionally ignored so a fast
 * flick can't trip it.
 */
export function resolveSwipe(x: number): boolean {
  return -x >= OPEN_AT
}

/**
 * Mirror of {@link resolveSwipe} for a rightward reveal (e.g. Assign): whether a
 * release at absolute x should open the right-edge action. Position-based, same
 * deliberate threshold.
 */
export function resolveSwipeRight(x: number): boolean {
  return x >= OPEN_AT
}
