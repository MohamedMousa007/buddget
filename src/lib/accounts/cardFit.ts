/** Card face width and the gap between faces in a row, in px (CardFaceChip). */
export const FACE_W = 88
export const FACE_GAP = 8
/** The visible strip of a tucked card when nothing was measured. */
export const DEFAULT_STACK_OFFSET = 52
const FACE_PAD = 7
const AIR = 3

/** True when `n` faces side by side, their gaps and the "N cards" label fit in `room` px; otherwise they stack. */
export function fitsInRow(n: number, labelWidth: number, room: number): boolean {
  if (n <= 0) return true
  return n * FACE_W + (n - 1) * FACE_GAP + FACE_GAP + labelWidth <= room
}

/**
 * How far each tucked card sits right of the one in front, so its kind label (top right) and digits (bottom right) both
 * show: the wider of the two plus the face padding and a little air. 52px until measured.
 */
export function stackOffset(measured?: { kindW: number; digitsW: number }): number {
  if (!measured) return DEFAULT_STACK_OFFSET
  return Math.ceil(Math.max(measured.kindW, measured.digitsW)) + FACE_PAD + AIR
}

/** Stack width for `n` faces at a given offset. */
export const stackWidth = (n: number, offset: number): number => (n <= 0 ? 0 : FACE_W + (n - 1) * offset)
