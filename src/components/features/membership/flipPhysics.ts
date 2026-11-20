/**
 * The card rig's motion, kept pure so it can be tested without a browser: a damped spring turns the card, it lifts mid-turn,
 * the pointer tilts it and moves the light. Constants are the mockup's (docs/design/pro-rewards/mockup.html), tuned per 60 Hz step.
 */
export interface RigState {
  /** Current turn in degrees: 0 is the front, 180 the back. */
  flip: number
  flipV: number
  target: 0 | 180
  /** Pointer position over the card, -1 to 1 on each axis (where the pointer is, then the eased value). */
  tx: number
  ty: number
  px: number
  py: number
  /** 1 while a fine pointer is over the card: shows the hover light. */
  hover: 0 | 1
}

export const STEP_MS = 1000 / 60

export const initialRig = (flipped = false): RigState => ({ flip: flipped ? 180 : 0, flipV: 0, target: flipped ? 180 : 0, tx: 0, ty: 0, px: 0, py: 0, hover: 0 })

export const toggleTarget = (target: 0 | 180): 0 | 180 => (target === 0 ? 180 : 0)

/** One 60 Hz step, in place. Reduced motion: the turn lands at once and the card never tilts. */
export function stepRig(r: RigState, reduce: boolean): RigState {
  if (reduce) {
    r.flip = r.target
    r.flipV = 0
    r.px = 0
    r.py = 0
    return r
  }
  r.flipV += (r.target - r.flip) * 0.06
  r.flipV *= 0.8
  r.flip += r.flipV
  r.px += (r.tx - r.px) * 0.12
  r.py += (r.ty - r.py) * 0.12
  return r
}

export interface RigFrame {
  lift: string
  card: string
  floor: string
  floorOpacity: string
  /** Past 90 degrees the back faces the viewer. The rig hides the other face by itself, not only by backface-visibility (BDG-003). */
  showBack: boolean
  /** Custom properties for both faces: sheen position and strength, light position, light strength. */
  vars: { '--sx': string; '--sa': string; '--mx': string; '--my': string; '--ga': string }
}

/** What to paint for a state at `t` seconds. Reduced motion: no float, no wobble, no hover light. */
export function rigFrame(r: RigState, t: number, reduce: boolean): RigFrame {
  // How far through the turn, 0 at rest on either face and 1 edge-on. A still card (reduced motion) is never mid-turn.
  const turning = reduce ? 0 : Math.sin((Math.min(180, Math.max(0, r.flip)) / 180) * Math.PI)
  const float = reduce ? 0 : Math.sin(t * 1.05) * 5
  const back = r.flip > 90
  const dir = back ? -1 : 1
  const wobble = reduce ? 0 : Math.sin(t * 0.8) * 1.6
  return {
    lift: `translateY(${float - turning * 14}px)`,
    card: `rotateY(${r.flip + r.px * 11 * dir}deg) rotateX(${-r.py * 8 + wobble}deg) scale(${1 + turning * 0.07})`,
    floor: `translateX(-50%) scale(${(1 - turning * 0.35) * (1 - float / 70)}, ${1 - turning * 0.2})`,
    floorOpacity: String(0.9 - turning * 0.4),
    showBack: back,
    vars: {
      '--sx': `${-60 + (r.flip / 180) * 120 + r.px * 15}%`,
      '--sa': String(0.18 + turning * 0.7),
      '--mx': `${50 + (back ? -r.px : r.px) * 45}%`,
      '--my': `${50 + r.py * 45}%`,
      '--ga': reduce ? '0' : String(r.hover),
    },
  }
}

/** Pointer position over a box as -1..1 on each axis. */
export function pointerTilt(clientX: number, clientY: number, box: { left: number; top: number; width: number; height: number }): { tx: number; ty: number } {
  return { tx: ((clientX - box.left) / box.width - 0.5) * 2, ty: ((clientY - box.top) / box.height - 0.5) * 2 }
}
