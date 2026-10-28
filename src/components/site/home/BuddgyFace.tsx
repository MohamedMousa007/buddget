'use client'

import { useEffect, useRef } from 'react'

export type FaceMood = 'awake' | 'happy' | 'curious' | 'worried' | 'alert'

const SHELL = [
  'M3.5 12.5a8.5 8.5 0 0 1 17 0V16a5 5 0 0 1-5 5h-7a5 5 0 0 1-5-5z',
  'M10 8.5h4a3.5 3.5 0 0 1 3.5 3.5v2.5a3.5 3.5 0 0 1-3.5 3.5h-4a3.5 3.5 0 0 1-3.5-3.5V12a3.5 3.5 0 0 1 3.5-3.5z',
  'M20.5 12h.5a1.5 1.5 0 0 1 1.5 1.5v2a1.5 1.5 0 0 1-1.5 1.5h-.5',
  'M3.5 12H3a1.5 1.5 0 0 0-1.5 1.5v2A1.5 1.5 0 0 0 3 17h.5',
  'M16.3 5.2 17.5 2.5',
]

const FACES: Record<FaceMood, { color: string; paths: string[] }> = {
  awake: { color: '#1FC3B2', paths: ['M9.75 12.5v1.75', 'M14.25 12.5v1.75'] },
  happy: { color: '#F0BE5B', paths: ['M8.5 14a1.75 1.75 0 0 1 3 0', 'M12.5 14a1.75 1.75 0 0 1 3 0'] },
  curious: { color: '#1FC3B2', paths: ['M9.75 13v1.25', 'M14.25 12v2.25', 'M13.25 10.5l2-.5'] },
  worried: { color: '#F0BE5B', paths: ['M9.75 13v1', 'M14.25 13v1', 'M8.75 11.75 10.5 11', 'M15.25 11.75 13.5 11', 'M10.75 16.5a2 2 0 0 1 2.5 0'] },
  alert: { color: '#E5684D', paths: ['M12 10.75v2.5', 'M12 15.75h.01'] },
}

/** Buddgy's visor with a mood. The eyes follow the pointer on pointer devices. Marketing replica of the app icon. */
export function BuddgyFace({ mood, size, shell = '#F4F7F6', track = true, label = 'Buddgy' }: { mood: FaceMood; size: number; shell?: string; track?: boolean; label?: string }) {
  const face = FACES[mood]
  const root = useRef<SVGSVGElement>(null)
  const eyes = useRef<SVGGElement>(null)

  useEffect(() => {
    if (!track || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const onMove = (e: PointerEvent) => {
      const r = root.current?.getBoundingClientRect()
      if (!r || !eyes.current) return
      const dx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / 400))
      const dy = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / 400))
      eyes.current.setAttribute('transform', `translate(${(dx * 0.9).toFixed(2)} ${(dy * 0.7).toFixed(2)})`)
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [track])

  return (
    <svg ref={root} viewBox="0 0 24 24" width={size} height={size} fill="none" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label={label}>
      <g stroke={shell}>{SHELL.map((d) => <path key={d} d={d} />)}</g>
      <g ref={eyes} stroke={face.color} strokeWidth="1.6">{face.paths.map((d) => <path key={d} d={d} />)}</g>
    </svg>
  )
}
