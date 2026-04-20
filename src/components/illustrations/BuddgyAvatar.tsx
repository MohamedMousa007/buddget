'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

/**
 * Buddgy — Buddget brand mark.
 *
 * Minimal two-tone emblem: a soft-edged circle in the brand red with
 * a single inner "smile" arc that shifts slightly per pose to read as
 * a character without tipping into cartoon territory. The companion
 * accent dot (amber) marks a consistent north-east orientation so the
 * mark stays recognisable at every size.
 *
 * Design intent
 * -------------
 * - Feels like a logo / app-icon first, character second. Sits next
 *   to a button or a headline without pulling attention.
 * - Single SVG — no network request, scales cleanly from 28 px to
 *   160 px.
 * - Pose variants shift only the smile geometry + the accent dot size
 *   so the silhouette is constant across states.
 * - Idle breathing is a very subtle scale pulse (1.0 → 1.012 → 1.0 on
 *   a 4 s ease). Respects `prefers-reduced-motion` via the app-wide
 *   `MotionConfigRoot`.
 */
export type BuddgyPose = 'greeting' | 'thinking' | 'celebrating' | 'pointing'
export type BuddgySize = 'xs' | 'sm' | 'md' | 'lg'
export type BuddgyPointDirection = 'left' | 'right' | 'down'

export interface BuddgyAvatarProps {
  pose?: BuddgyPose
  size?: BuddgySize
  /** Direction the accent dot points when `pose === 'pointing'`. */
  pointDirection?: BuddgyPointDirection
  /** Disable the idle breathing loop (e.g. in a static preview). */
  still?: boolean
  className?: string
}

const SIZE_PX: Record<BuddgySize, number> = {
  xs: 32,
  sm: 44,
  md: 72,
  lg: 128,
}

export function BuddgyAvatar({
  pose = 'greeting',
  size = 'sm',
  pointDirection = 'down',
  still = false,
  className,
}: BuddgyAvatarProps) {
  const px = SIZE_PX[size]

  return (
    <motion.div
      className={cn('relative inline-block', className)}
      style={{ width: px, height: px }}
      animate={still ? undefined : { scale: [1, 1.012, 1] }}
      transition={
        still
          ? undefined
          : { duration: 4, repeat: Infinity, ease: 'easeInOut', repeatType: 'loop' }
      }
      aria-hidden
    >
      <svg viewBox="0 0 100 100" width={px} height={px}>
        <defs>
          {/* Soft inner glow — subtle depth without reading as a 3D ball. */}
          <radialGradient id="buddgyBody" cx="50%" cy="45%" r="55%">
            <stop offset="0%" stopColor="#E85761" />
            <stop offset="100%" stopColor="var(--color-brand-red, #D1121F)" />
          </radialGradient>
        </defs>

        {/* Primary disc */}
        <circle cx="50" cy="50" r="44" fill="url(#buddgyBody)" />

        {/* Hairline rim at ~92% — keeps the mark crisp at small sizes. */}
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke="rgba(255,255,255,0.18)"
          strokeWidth="1.2"
        />

        {/* Expression — a single arc whose geometry shifts per pose. */}
        <Smile pose={pose} />

        {/* North-east accent dot: brand-amber marker. Grows slightly
            in 'celebrating', pulses subtly in 'thinking'. */}
        <AccentDot pose={pose} pointDirection={pointDirection} />
      </svg>
    </motion.div>
  )
}

// ─── Smile variants ────────────────────────────────────────────────────

function Smile({ pose }: { pose: BuddgyPose }) {
  // All smiles are drawn within a consistent box so the center of
  // gravity stays put across variants.
  const stroke = 'rgba(255,255,255,0.92)'
  const width = 2.8
  if (pose === 'thinking') {
    // Slightly raised, narrower — reading as a considering pause.
    return (
      <path
        d="M 40 58 Q 50 62 60 58"
        stroke={stroke}
        strokeWidth={width}
        strokeLinecap="round"
        fill="none"
      />
    )
  }
  if (pose === 'celebrating') {
    // Wider upward arc — a confident grin without teeth.
    return (
      <path
        d="M 36 56 Q 50 68 64 56"
        stroke={stroke}
        strokeWidth={width + 0.2}
        strokeLinecap="round"
        fill="none"
      />
    )
  }
  if (pose === 'pointing') {
    // Asymmetric lift on one side (wink-like), no eyes needed.
    return (
      <path
        d="M 38 58 Q 50 64 62 54"
        stroke={stroke}
        strokeWidth={width}
        strokeLinecap="round"
        fill="none"
      />
    )
  }
  // greeting — default balanced arc
  return (
    <path
      d="M 38 57 Q 50 65 62 57"
      stroke={stroke}
      strokeWidth={width}
      strokeLinecap="round"
      fill="none"
    />
  )
}

// ─── Accent dot ────────────────────────────────────────────────────────

function AccentDot({
  pose,
  pointDirection,
}: {
  pose: BuddgyPose
  pointDirection: BuddgyPointDirection
}) {
  // Default NE position — anchor of the mark's personality.
  let cx = 75
  let cy = 25
  let r = 5
  if (pose === 'celebrating') r = 6.5
  if (pose === 'thinking') r = 4
  if (pose === 'pointing') {
    if (pointDirection === 'left') {
      cx = 20
      cy = 50
    } else if (pointDirection === 'right') {
      cx = 80
      cy = 50
    } else {
      cx = 50
      cy = 80
    }
  }

  return <circle cx={cx} cy={cy} r={r} fill="var(--color-brand-amber, #F5A623)" />
}
