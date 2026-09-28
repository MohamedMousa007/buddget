// Buddgy visor icon — Lucide-compatible API. Requires handoff/buddgy-motion.css.
import type { SVGProps } from 'react'

export type BuddgyMood =
  | 'idle' | 'small' | 'listening' | 'thinking' | 'scanning'
  | 'done' | 'happy' | 'alert' | 'error' | 'offline'

type Tone = 'ink' | 'brand' | 'danger' | 'green' | 'gold' | 'amber' | 'muted'

const SHELL = [
  'M3.5 12.5a8.5 8.5 0 0 1 17 0V16a5 5 0 0 1-5 5h-7a5 5 0 0 1-5-5z',
  'M10 8.5h4a3.5 3.5 0 0 1 3.5 3.5v2.5a3.5 3.5 0 0 1-3.5 3.5h-4a3.5 3.5 0 0 1-3.5-3.5V12a3.5 3.5 0 0 1 3.5-3.5z',
  'M20.5 12h.5a1.5 1.5 0 0 1 1.5 1.5v2a1.5 1.5 0 0 1-1.5 1.5h-.5',
  'M3.5 12H3a1.5 1.5 0 0 0-1.5 1.5v2A1.5 1.5 0 0 0 3 17h.5',
  'M16.3 5.2 17.5 2.5',
]

// [d, per-path class, animation-delay ms]
const FACES: Record<BuddgyMood, { tone: Tone; face?: string; icon?: string; paths: [string, string?, number?][] }> = {
  idle:      { tone: 'ink',   paths: [['M10.25 10.75v5'], ['M10.25 10.75h2a1.25 1.25 0 0 1 0 2.5h-2'], ['M10.25 13.25h2.5a1.25 1.25 0 0 1 0 2.5h-2.5']] },
  small:     { tone: 'ink',   paths: [['M9.5 13.25h.01'], ['M14.5 13.25h.01']] },
  listening: { tone: 'brand',   paths: [['M9 12.5v1.5', 'bg-fb bg-listen', 0], ['M12 11v4.5', 'bg-fb bg-listen', 120], ['M15 12v2.5', 'bg-fb bg-listen', 240]] },
  thinking:  { tone: 'brand',   paths: [['M9 13.25h.01', 'bg-think', 0], ['M12 13.25h.01', 'bg-think', 160], ['M15 13.25h.01', 'bg-think', 320]] },
  scanning:  { tone: 'brand',   paths: [['M8.5 13.25h7', 'bg-fb bg-scan']] },
  done:      { tone: 'green', paths: [['M9.25 13.5 11 15.25l3.75-3.75', 'bg-draw']] },
  happy:     { tone: 'gold',  face: 'bg-fb bg-hop', paths: [['M8.5 14a1.75 1.75 0 0 1 3 0'], ['M12.5 14a1.75 1.75 0 0 1 3 0']] },
  alert:     { tone: 'amber', icon: 'bg-shake', paths: [['M12 10.75v2.5'], ['M12 15.75h.01']] },
  error:     { tone: 'danger',   face: 'bg-fb bg-nope', paths: [['M9.5 12.25h.01'], ['M14.5 12.25h.01'], ['M10 15.75a2.5 2.5 0 0 1 4 0']] },
  offline:   { tone: 'muted', paths: [['M8.5 13.75h2.5'], ['M13 13.75h2.5']] },
}

const TONE_VAR: Record<Tone, string> = {
  ink: 'currentColor',
  brand: 'var(--color-brand-teal, #12B0A0)',
  danger: 'var(--color-negative, #E5484D)',
  green: 'var(--color-positive, #18A349)',
  gold: 'var(--color-gold, #D4A017)',
  amber: 'var(--color-warning, #E0A126)',
  muted: 'var(--color-brand-text-muted)',
}

interface BuddgyIconProps extends Omit<SVGProps<SVGSVGElement>, 'mood'> {
  mood?: BuddgyMood
  size?: number
  strokeWidth?: number
  /** 'duo' colours the face with the mood token; 'outline' is single colour. */
  variant?: 'duo' | 'outline'
  animated?: boolean
}

export function BuddgyIcon({ mood = 'idle', size = 24, strokeWidth = 2, variant = 'duo', animated = true, ...rest }: BuddgyIconProps) {
  const m = FACES[size <= 16 && mood === 'idle' ? 'small' : mood]
  const shell = mood === 'offline' ? TONE_VAR.muted : 'currentColor'
  const face = variant === 'duo' ? TONE_VAR[m.tone] : shell
  const a = (c?: string) => (animated ? c : undefined)
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      <g className={a(m.icon)}>
        <g stroke={shell}>{SHELL.map((d) => <path key={d} d={d} />)}</g>
        {/* key={mood} remounts the face so one-shots replay and the face-in runs on every mood change */}
        <g key={mood} stroke={face} className={a('bg-fb bg-face-in')}>
          <g className={a(m.face)}>
            {m.paths.map(([d, cls, delay]) => (
              <path key={d} d={d} className={a(cls)} pathLength={cls?.includes('bg-draw') ? 10 : undefined}
                style={animated && delay ? { animationDelay: `${delay}ms` } : undefined} />
            ))}
          </g>
        </g>
      </g>
    </svg>
  )
}
