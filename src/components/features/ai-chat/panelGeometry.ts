import type { BuddgyOrbPosition } from '@/lib/store/useSettingsStore'

export const ORB_SIZE = 56
export const ORB_INSET = 8

const DESKTOP_BP = 1024
const PANEL_W = 400
const PANEL_H = 600
const EDGE_GAP = 12 // gap from the viewport / safe-area edge
const FAB_CLEAR = 96 // desktop: keep the bottom-right QuickAdd FAB uncovered
const NAV_CLEAR = 76 // mobile: keep the bottom tab bar uncovered
const HEADER_CLEAR = 52 // mobile: keep the fixed top header uncovered
/** A visual viewport this much shorter than the layout viewport means the iOS keyboard is up. */
const KEYBOARD_MIN = 120

export interface Insets { top: number; bottom: number; left: number; right: number }

/** The part of the screen the user can see: the visual viewport, which the keyboard shrinks. */
export interface Viewport {
  width: number
  height: number
  /** How far iOS has panned the visual viewport down inside the layout viewport. */
  offsetTop: number
  keyboard: boolean
}

/** Panel geometry, anchored to the orb and clamped inside the safe area. */
export interface PanelGeometry {
  side: 'left' | 'right'
  top: number
  width: number
  height: number
  /** Horizontal inset from the orb's edge (incl. safe-area). */
  sideInset: number
  /** Transform-origin at the orb's centre, so the panel grows out of Buddgy. */
  originX: number
  originY: number
}

/**
 * iOS (no Keyboard plugin) keeps the layout viewport and shrinks the visual one; Android (`adjustResize`) shrinks both, so
 * there a focused text field is the only sign. Either one counts (BDG-014).
 */
export function keyboardOpen(layoutHeight: number, vvHeight: number, vvOffsetTop: number, textFocused: boolean): boolean {
  return textFocused || layoutHeight - vvHeight - vvOffsetTop > KEYBOARD_MIN
}

function textFieldFocused(): boolean {
  const el = document.activeElement
  if (!(el instanceof HTMLElement)) return false
  return el.isContentEditable || el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && !['button', 'checkbox', 'radio', 'range', 'submit'].includes((el as HTMLInputElement).type))
}

export function readViewport(): Viewport | null {
  if (typeof window === 'undefined') return null
  const vv = window.visualViewport
  const height = vv?.height ?? window.innerHeight
  const offsetTop = vv?.offsetTop ?? 0
  return { width: window.innerWidth, height, offsetTop, keyboard: keyboardOpen(window.innerHeight, height, offsetTop, textFieldFocused()) }
}

/** Resolved safe-area insets in px (mirrored from CSS env via custom props). */
export function safeAreaInsets(): Insets {
  if (typeof window === 'undefined') return { top: 0, bottom: 0, left: 0, right: 0 }
  const cs = getComputedStyle(document.documentElement)
  const px = (v: string) => parseFloat(cs.getPropertyValue(v)) || 0
  return { top: px('--sai-top'), bottom: px('--sai-bottom'), left: px('--sai-left'), right: px('--sai-right') }
}

/**
 * The panel sits inside what the user can see. With the keyboard up there is no tab bar, header or home indicator to keep
 * clear, so the panel takes the visible height above the keyboard and the composer stays in view.
 */
export function computePanel(orb: BuddgyOrbPosition, view: Viewport, safe: Insets): PanelGeometry {
  const desktop = view.width >= DESKTOP_BP
  const kb = view.keyboard && !desktop
  const ins = kb ? { ...safe, top: view.offsetTop > 0 ? 0 : safe.top, bottom: 0 } : safe
  const vh = view.height

  const width = desktop ? PANEL_W : Math.min(PANEL_W, view.width - ins.left - ins.right - EDGE_GAP * 2)
  const availH = vh - ins.top - ins.bottom - EDGE_GAP * 2
  const height = kb ? availH : Math.min(desktop ? PANEL_H : Math.round(vh * 0.82), PANEL_H, availH)

  // The bottom nav (mobile) / floating FAB (desktop, right side only) must stay clear; the keyboard covers both.
  const bottomClear = kb ? EDGE_GAP : desktop ? (orb.side === 'right' ? FAB_CLEAR : EDGE_GAP) : NAV_CLEAR
  const topClear = kb || desktop ? EDGE_GAP : HEADER_CLEAR + EDGE_GAP

  const orbCenter = orb.top + ORB_SIZE / 2
  const minTop = view.offsetTop + ins.top + topClear
  const maxTop = Math.max(minTop, view.offsetTop + vh - ins.bottom - height - bottomClear)
  const top = Math.max(minTop, Math.min(maxTop, orbCenter - height / 2))
  const sideInset = (orb.side === 'left' ? ins.left : ins.right) + EDGE_GAP
  return { side: orb.side, top, width, height, sideInset, originX: ORB_INSET + ORB_SIZE / 2 - sideInset, originY: orbCenter - top }
}

/** Releasing the orb this close to the middle keeps its side, so a small wobble never flips it (BDG-018). */
export const SNAP_DEAD_ZONE = 24

/** The edge the orb springs to when let go: the nearer one, by where its centre is, not where the finger is. */
export function snapSide(orbCenterX: number, screenWidth: number, current: 'left' | 'right'): 'left' | 'right' {
  const mid = screenWidth / 2
  if (Math.abs(orbCenterX - mid) <= SNAP_DEAD_ZONE) return current
  return orbCenterX < mid ? 'left' : 'right'
}

/** The orb's left edge while it follows the finger, kept inside the screen. */
export function dragLeft(fingerX: number, screenWidth: number): number {
  return Math.max(ORB_INSET, Math.min(screenWidth - ORB_SIZE - ORB_INSET, fingerX - ORB_SIZE / 2))
}
