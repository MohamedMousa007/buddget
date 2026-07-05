// Pure, DOM-free gesture math for pull-to-refresh (BUD-57). Kept separate from
// the React component so it is unit-testable in the node vitest env.

export const THRESHOLD = 80 // resisted px to commit a refresh
export const MAX_PULL = 110 // cap on how far the indicator follows the finger
export const RESISTANCE = 0.5 // finger travel → indicator travel

/** Resisted indicator travel for a raw downward finger delta (px). */
export function resistedPull(dy: number): number {
  if (dy <= 0) return 0
  return Math.min(dy * RESISTANCE, MAX_PULL)
}

/**
 * May a gesture engage the pull? Only when it BEGINS at the window top. A hard
 * scroll that lands at the top lifts the finger first, so a refresh always
 * needs a fresh second swipe — the same swipe that scrolled up can never
 * trigger it (the BUD-57 complaint). `scrollY` here is the WINDOW scroll
 * position; `main` is not a scroll container so its scrollTop is always 0.
 */
export function canEngage(scrollYAtStart: number): boolean {
  return scrollYAtStart <= 0
}

/** Should releasing the gesture commit a refresh? */
export function shouldCommit(scrollYAtStart: number, dy: number): boolean {
  return canEngage(scrollYAtStart) && resistedPull(dy) >= THRESHOLD
}
