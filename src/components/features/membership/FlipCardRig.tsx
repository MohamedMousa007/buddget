'use client'

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { STEP_MS, initialRig, pointerTilt, rigFrame, stepRig, toggleTarget, type RigState } from './flipPhysics'
import s from './cards.module.css'

export interface FlipCardRigProps {
  /** The two faces: `CardFace` elements (or anything that fills the card). */
  front: ReactNode
  back: ReactNode
  /** Accessible name of the flip control, e.g. "Your buddget Pro membership card. Tap to flip". */
  label: string
  /** Greys both faces (a tier that needs Pro). The card still flips. */
  dimmed?: boolean
  /** Centred over the card and not turned with it: the lock pill. */
  overlay?: ReactNode
  defaultFlipped?: boolean
  onFlip?: (flipped: boolean) => void
  className?: string
  /** Custom properties for the faces (a tier's stock and foil). */
  style?: CSSProperties
}

/**
 * The stage every membership card stands on: tap turns it on a damped spring, it lifts toward you mid-turn, a sheen sweeps across
 * and the floor shadow pulls in. A mouse tilts it and moves the hover light; touch does not. Reduced motion shows a still card
 * that swaps faces at once.
 */
export function FlipCardRig({ front, back, label, dimmed, overlay, defaultFlipped = false, onFlip, className, style }: FlipCardRigProps) {
  const [flipped, setFlipped] = useState(defaultFlipped)
  const rig = useRef<RigState>(initialRig(defaultFlipped))
  const root = useRef<HTMLDivElement>(null)
  const lift = useRef<HTMLDivElement>(null)
  const card = useRef<HTMLDivElement>(null)
  const floor = useRef<HTMLDivElement>(null)
  const frontSlot = useRef<HTMLDivElement>(null)
  const backSlot = useRef<HTMLDivElement>(null)
  const wakeRef = useRef<() => void>(() => {})

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let visible = true
    let raf = 0
    let last = performance.now()
    let acc = 0
    const t0 = last

    const paint = (now: number) => {
      const f = rigFrame(rig.current, (now - t0) / 1000, motion.matches)
      if (lift.current) lift.current.style.transform = f.lift
      if (card.current) card.current.style.transform = f.card
      if (floor.current) {
        floor.current.style.transform = f.floor
        floor.current.style.opacity = f.floorOpacity
      }
      for (const el of [frontSlot.current, backSlot.current]) {
        if (!el) continue
        for (const [k, v] of Object.entries(f.vars)) el.style.setProperty(k, v)
      }
    }
    const tick = (now: number) => {
      // The spring is tuned per 60 Hz step; a fixed step keeps it the same speed on a 120 Hz screen.
      if (motion.matches) stepRig(rig.current, true)
      else {
        acc = Math.min(acc + (now - last), STEP_MS * 5)
        while (acc >= STEP_MS) {
          stepRig(rig.current, false)
          acc -= STEP_MS
        }
      }
      last = now
      paint(now)
      raf = visible && !motion.matches ? requestAnimationFrame(tick) : 0
    }
    const wake = () => {
      if (raf) return
      last = performance.now()
      raf = requestAnimationFrame(tick)
    }
    wakeRef.current = wake
    // Off screen the loop sleeps; under reduced motion it runs one frame per change.
    const io = new IntersectionObserver(([e]) => {
      visible = e?.isIntersecting ?? true
      if (visible) wake()
    })
    if (root.current) io.observe(root.current)
    motion.addEventListener('change', wake)
    wake()
    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
      motion.removeEventListener('change', wake)
    }
  }, [])

  const flip = () => {
    const target = toggleTarget(rig.current.target)
    rig.current.target = target
    setFlipped(target === 180)
    onFlip?.(target === 180)
    wakeRef.current()
  }
  // Tilt and the hover light are for a mouse: a finger resting on the card should not skew it.
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse') return
    Object.assign(rig.current, pointerTilt(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect()), { hover: 1 })
  }
  const onLeave = () => Object.assign(rig.current, { tx: 0, ty: 0, hover: 0 })

  return (
    <div ref={root} className={cn(s.rig, dimmed && s.dimmed, className)} style={style} data-flipped={flipped} data-dimmed={dimmed || undefined}>
      <div ref={floor} className={s.floor} aria-hidden />
      <div ref={lift} className={s.lift}>
        <div ref={card} dir="ltr" className={s.mcard} onClick={flip} onPointerMove={onMove} onPointerLeave={onLeave} style={defaultFlipped ? { transform: 'rotateY(180deg)' } : undefined}>
          <div ref={frontSlot} className={s.slot} aria-hidden={flipped || undefined}>{front}</div>
          <div ref={backSlot} className={cn(s.slot, s.slotBack)} aria-hidden={!flipped || undefined}>{back}</div>
          <button type="button" className={s.hit} aria-label={label} aria-pressed={flipped} data-raw-button-ok="the whole card is the control; it has no visual of its own" />
        </div>
        {overlay ? <div className={s.overlay}>{overlay}</div> : null}
      </div>
    </div>
  )
}

export type CardFaceFinish = 'obsidian' | 'letterpress' | 'founder'

/** One side of a card: the surface, its content, then the sheen and the hover light the rig drives. */
export function CardFace({ finish, children, style, className }: { finish: CardFaceFinish; children: ReactNode; style?: CSSProperties; className?: string }) {
  return (
    <div className={cn(s.face, s[finish], finish !== 'letterpress' && s.hairline, className)} style={style} data-finish={finish}>
      {children}
      <span className={s.sheen} aria-hidden />
      <span className={s.glare} aria-hidden />
    </div>
  )
}

/** The spotlight a card stands in, with the "Tap the card" line under it. Bleeds to the page edges: set `--gutter` if the page gutter is not 16px. */
export function CardSpotlight({ children, hint, className }: { children: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <div className={cn(s.spot, className)}>
      {children}
      {hint ? <p dir="auto" className={s.tap}>{hint}</p> : null}
    </div>
  )
}

/** The pill over a locked card: "Pro members only". */
export function LockPill({ children }: { children: ReactNode }) {
  return <span dir="auto" className={s.lockpill}>{children}</span>
}
