// Pure, DOM-free snap math for swipe-to-delete. Kept separate from the React
// component so it is unit-testable in the node vitest env.

// Fraction of the card width the row must travel left before a release commits
// the delete. High on purpose: a deliberate near-full swipe, not a light flick.
export const COMMIT_FRACTION = 0.85

/**
 * Given the row's absolute x at drag end (0 = closed, negative = swiped left)
 * and the measured card width, return whether the release should delete. Only a
 * leftward swipe past COMMIT_FRACTION of the width commits — velocity is
 * intentionally ignored so a fast flick can't trigger a delete.
 */
export function resolveSwipe(x: number, width: number): boolean {
  return width > 0 && -x >= width * COMMIT_FRACTION
}
