'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import { cn } from '@/lib/utils'
import { Emphasis } from './Emphasis'
import type { GuideStop } from './guideStops'
import s from './smsSetup.module.css'

const SLOT_MS = 3200

/**
 * The guide's walkthrough (approved mockups sms-guide-ios27-v2 / ios26-v2): real Shortcuts captures, one stop every
 * 3.2 s, looping. Each stop dims everything but a cut-out in the target's shape that opens wide and closes in, then a
 * tip and a tap. Coordinates are LTR capture coordinates, so the player never mirrors.
 */
export function GuideWalkthrough({ stops, tips, aspect, maxHeight = 440 }: { stops: GuideStop[]; tips: string[]; aspect: number; maxHeight?: number }) {
  const [index, setIndex] = useState(0)
  // Each step mounts its own player (keyed by step), so the index starts at 0 without a reset here.
  useEffect(() => {
    if (stops.length < 2) return
    const id = window.setInterval(() => setIndex((i) => (i + 1) % stops.length), SLOT_MS)
    return () => window.clearInterval(id)
  }, [stops])
  const prev = (index - 1 + stops.length) % stops.length

  return (
    <div dir="ltr" className={cn(s.illo, 'flex h-full min-h-0 flex-col items-center')} style={{ '--slot': `${SLOT_MS}ms` } as CSSProperties} aria-hidden>
      <div className={s.player} style={{ aspectRatio: `${aspect}`, '--player-max': `${maxHeight}px` } as CSSProperties}>
        <div className={s.screen}>
          {stops.map((stop, i) => (
            <div
              key={`${stop.src}-${i}-${i === index ? index : 'x'}`}
              className={cn(s.stop, i === index ? s.stopActive : i === prev && stops.length > 1 ? s.stopPrev : null)}
              style={{ '--x': `${stop.x}%`, '--y': `${stop.y}%`, '--w': `${stop.w}%`, '--h': `${stop.h}%`, '--r': `${stop.radius}px`, '--z': stop.zoom, '--ty': `${stop.tipY}%` } as CSSProperties}
            >
              <img className={s.shot} src={stop.src} alt="" draggable={false} />
              <div className={s.spot} />
              {stop.tap === false ? null : <div className={s.tap} />}
              <div className={s.tip}><Emphasis text={tips[i] ?? ''} boldClassName="" /></div>
            </div>
          ))}
        </div>
      </div>
      <div className={s.dots}>
        {stops.map((_, i) => <i key={i === index ? `a${index}` : i} className={cn(s.dot, i === index && s.dotActive)} />)}
      </div>
    </div>
  )
}
