'use client'

// Buddgy visor icon — Lucide-compatible API. Requires app/buddgy-motion.css.
import type { CSSProperties, SVGProps } from 'react'

export type BuddgyMood =
  | 'idle' | 'small' | 'listening' | 'thinking' | 'scanning'
  | 'done' | 'happy' | 'alert' | 'error' | 'offline'
  // Character faces: the orb and chat use these to feel alive.
  | 'awake' | 'wink' | 'sleepy' | 'curious' | 'worried' | 'talking'

type Tone = 'ink' | 'brand' | 'danger' | 'green' | 'gold' | 'amber' | 'muted'

const SHELL = [
  'M3.5 12.5a8.5 8.5 0 0 1 17 0V16a5 5 0 0 1-5 5h-7a5 5 0 0 1-5-5z',
  'M10 8.5h4a3.5 3.5 0 0 1 3.5 3.5v2.5a3.5 3.5 0 0 1-3.5 3.5h-4a3.5 3.5 0 0 1-3.5-3.5V12a3.5 3.5 0 0 1 3.5-3.5z',
  'M20.5 12h.5a1.5 1.5 0 0 1 1.5 1.5v2a1.5 1.5 0 0 1-1.5 1.5h-.5',
  'M3.5 12H3a1.5 1.5 0 0 0-1.5 1.5v2A1.5 1.5 0 0 0 3 17h.5',
  'M16.3 5.2 17.5 2.5',
]

const EYES: [string, string][] = [['M9.75 12.5v1.75', 'bg-fb bg-blink'], ['M14.25 12.5v1.75', 'bg-fb bg-blink']]

// [d, per-path class, animation-delay ms]
const FACES: Record<BuddgyMood, { tone: Tone; face?: string; icon?: string; paths: [string, string?, number?][] }> = {
  idle:      { tone: 'ink',   paths: [['M10.25 10.75v5'], ['M10.25 10.75h2a1.25 1.25 0 0 1 0 2.5h-2'], ['M10.25 13.25h2.5a1.25 1.25 0 0 1 0 2.5h-2.5']] },
  small:     { tone: 'ink',   paths: [['M9.5 13.25h.01'], ['M14.5 13.25h.01']] },
  listening: { tone: 'brand',   paths: [['M9 12.5v1.5', 'bg-fb bg-listen', 0], ['M12 11v4.5', 'bg-fb bg-listen', 120], ['M15 12v2.5', 'bg-fb bg-listen', 240]] },
  // Three solid dots in a travelling wave — never fades to an empty visor.
  thinking:  { tone: 'brand',   paths: [['M9 13.5h.01', 'bg-fb bg-dot bg-think', 0], ['M12 13.5h.01', 'bg-fb bg-dot bg-think', 180], ['M15 13.5h.01', 'bg-fb bg-dot bg-think', 360]] },
  scanning:  { tone: 'brand',   paths: [['M8.5 13.25h7', 'bg-fb bg-scan']] },
  done:      { tone: 'green', paths: [['M9.25 13.5 11 15.25l3.75-3.75', 'bg-draw']] },
  happy:     { tone: 'gold',  face: 'bg-fb bg-hop', paths: [['M8.5 14a1.75 1.75 0 0 1 3 0'], ['M12.5 14a1.75 1.75 0 0 1 3 0']] },
  alert:     { tone: 'amber', icon: 'bg-shake', paths: [['M12 10.75v2.5'], ['M12 15.75h.01']] },
  error:     { tone: 'danger',   face: 'bg-fb bg-nope', paths: [['M9.5 12.25h.01'], ['M14.5 12.25h.01'], ['M10 15.75a2.5 2.5 0 0 1 4 0']] },
  offline:   { tone: 'muted', paths: [['M8.5 13.75h2.5'], ['M13 13.75h2.5']] },
  awake:     { tone: 'brand', paths: EYES },
  wink:      { tone: 'gold',  face: 'bg-fb bg-hop', paths: [EYES[0], ['M13.25 13.75l1-1 1 1'], ['M10.75 16a1.75 1.75 0 0 0 2.5 0']] },
  sleepy:    { tone: 'muted', face: 'bg-fb bg-breathe', paths: [['M8.75 14h2'], ['M13.25 14h2'], ['M18.75 4.25h1.75l-1.75 2h1.75', 'bg-fb bg-zzz']] },
  curious:   { tone: 'brand', icon: 'bg-tilt', paths: [['M9.75 13v1.25', 'bg-fb bg-blink'], ['M14.25 12v2.25', 'bg-fb bg-blink'], ['M13.25 10.5l2-.5']] },
  worried:   { tone: 'amber', face: 'bg-fb bg-wobble', paths: [['M9.75 13v1'], ['M14.25 13v1'], ['M8.75 11.75 10.5 11'], ['M15.25 11.75 13.5 11'], ['M10.75 16.5a2 2 0 0 1 2.5 0']] },
  talking:   { tone: 'brand', paths: [['M9.75 11.75v1.5', 'bg-fb bg-blink'], ['M14.25 11.75v1.5', 'bg-fb bg-blink'], ['M11.25 15.25h1.5a.75.75 0 0 1 0 1.5h-1.5a.75.75 0 0 1 0-1.5z', 'bg-fb bg-talk']] },
}

/**
 * Mapped onto Buddget's real tokens rather than the handoff's frozen hexes.
 *
 * The handoff was authored before the teal revamp, so its literal values
 * (ink #1A1A24, positive #18A349, negative #E5484D, warning #E0A126 …) no longer
 * match the app — and several of its light-mode values sit below WCAG AA, which
 * this palette deliberately fixed. The handoff's own instruction is to "map them
 * to the repo's CSS variables if equivalents exist"; they all do, and the
 * semantics are preserved exactly: teal brand, red for error ONLY, one distinct
 * colour per mood.
 *
 * `primary-bright` (not `primary`) is the identity teal — the face is a stroke on
 * a neutral surface, not text on a fill, so the vivid value is the right one.
 */
export const TONE_VAR: Record<Tone, string> = {
  ink: 'currentColor',
  brand: 'var(--color-brand-primary-bright)',
  danger: 'var(--color-brand-red)',
  green: 'var(--color-brand-green)',
  gold: 'var(--color-brand-gold)',
  amber: 'var(--color-brand-amber)',
  muted: 'var(--color-brand-text-muted)',
}

/** The accent colour a mood's face is drawn in. */
export function buddgyMoodColor(mood: BuddgyMood): string {
  const tone = FACES[mood].tone
  return tone === 'ink' ? TONE_VAR.brand : TONE_VAR[tone]
}

interface BuddgyIconProps extends Omit<SVGProps<SVGSVGElement>, 'mood'> {
  mood?: BuddgyMood
  size?: number
  strokeWidth?: number
  /** 'duo' colours the face with the mood token; 'outline' is single colour. */
  variant?: 'duo' | 'outline'
  animated?: boolean
  /** Solid head + visor, for when Buddgy stands on its own over page content. */
  filled?: boolean
  /** Ambient idle bob — the "breathing" that makes a standalone Buddgy feel alive. */
  alive?: boolean
  /** Where the eyes look, in SVG units (−1…1 each). */
  look?: { x: number; y: number }
}

export function BuddgyIcon({
  mood = 'idle', size = 24, strokeWidth = 2, variant = 'duo', animated = true,
  filled = false, alive = false, look, ...rest
}: BuddgyIconProps) {
  const m = FACES[size <= 16 && mood === 'idle' ? 'small' : mood]
  const shell = mood === 'offline' ? TONE_VAR.muted : 'currentColor'
  const face = variant === 'duo' ? TONE_VAR[m.tone] : shell
  const a = (c?: string) => (animated ? c : undefined)
  const lookStyle: CSSProperties | undefined = look
    ? { transform: `translate(${look.x}px, ${look.y}px)`, transition: 'transform 320ms cubic-bezier(.2,.9,.25,1)' }
    : undefined
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" overflow="visible" {...rest}>
      <g className={a(alive ? 'bg-fb bg-alive' : undefined)}>
        <g className={a(m.icon)}>
          <g stroke={shell}>
            {SHELL.map((d, i) => (
              <path key={d} d={d} fill={filled && i < 4 ? (i === 1 ? 'var(--color-brand-sunken)' : 'var(--color-brand-elevated)') : undefined} />
            ))}
          </g>
          {/* key={mood} remounts the face so one-shots replay and the face-in runs on every mood change */}
          <g key={mood} stroke={face} className={a('bg-fb bg-face-in')}>
            <g style={lookStyle}>
              <g className={a(m.face)}>
                {m.paths.map(([d, cls, delay]) => (
                  <path key={d} d={d} className={a(cls)} pathLength={cls?.includes('bg-draw') ? 10 : undefined}
                    style={animated && delay ? { animationDelay: `${delay}ms` } : undefined} />
                ))}
              </g>
            </g>
          </g>
        </g>
      </g>
    </svg>
  )
}
