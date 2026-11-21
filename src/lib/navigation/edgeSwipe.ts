/** Pure, DOM-light decisions for the iOS left-edge back swipe (BDG-017). */

export const EDGE_ZONE = 20 // pt from the leading edge a swipe must start in
export const SWIPE_THRESHOLD = 60 // pt of horizontal travel that commits a back
const SLOP = 10 // pt before the axis is decided

/** Does a touch at `x` start inside the leading-edge zone? Mirrored for RTL. */
export function startsInEdge(x: number, viewportWidth: number, rtl: boolean): boolean {
  return rtl ? x >= viewportWidth - EDGE_ZONE : x <= EDGE_ZONE
}

/** `cancel` = not a back swipe (vertical or wrong way); `pending` = undecided; `back` = commit. */
export type SwipeVerdict = 'pending' | 'cancel' | 'back'

/** Judge the travel so far. `final` is true on touchend, the only point a back is committed. */
export function swipeVerdict(dx: number, dy: number, rtl: boolean, final: boolean): SwipeVerdict {
  const along = rtl ? -dx : dx
  const across = Math.abs(dy)
  if (Math.hypot(dx, dy) >= SLOP && (across > Math.abs(along) || along < 0)) return 'cancel'
  if (!final) return 'pending'
  return along >= SWIPE_THRESHOLD && across <= along * 0.5 ? 'back' : 'cancel'
}

/** The parts of an element the target check reads (a real `Element` satisfies it). */
export interface EdgeTarget {
  closest?: (selector: string) => unknown
  parentElement?: EdgeTarget | null
  scrollWidth?: number
  clientWidth?: number
}

/** Controls and the Buddgy orb (`data-no-ptr`) keep their own touches. */
const OWN_TOUCH = '[data-no-ptr], input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="slider"]'

/**
 * Should a swipe starting on `target` be left alone? True for inputs, sliders, the orb, a
 * horizontal scroller (overflow-x with content to scroll) and a finger-driven carousel
 * (`touch-action: pan-y` or `none`, as PaymentCardCarousel sets). A vertical scroller with
 * `pan-y` (a ModalShell sheet body) is not a carousel, so a swipe there reaches the back guards.
 */
export function isIgnoredTarget(
  target: EdgeTarget | null,
  style: (el: EdgeTarget) => { overflowX: string; overflowY: string; touchAction: string },
): boolean {
  if (!target?.closest) return false
  if (target.closest(OWN_TOUCH)) return true
  const scrolls = (o: string) => o === 'auto' || o === 'scroll'
  for (let el: EdgeTarget | null | undefined = target; el; el = el.parentElement) {
    const s = style(el)
    if (s.touchAction === 'none' || (s.touchAction === 'pan-y' && !scrolls(s.overflowY))) return true
    if (scrolls(s.overflowX) && (el.scrollWidth ?? 0) > (el.clientWidth ?? 0) + 1) return true
  }
  return false
}
