'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

/**
 * Buddgy — the Buddget mascot.
 *
 * A friendly coin character: round body with a subtle rim, two big
 * eyes, a soft smile, and small amber cheeks. Drawn as a single inline
 * SVG so there's no network request and it scales cleanly from 36 px
 * to 120 px.
 *
 * Pose variants change the facial expression and accessories without
 * swapping the body silhouette, so the character reads consistently
 * across states.
 *
 * The idle breathing animation (subtle scale loop) is suppressed when
 * `prefers-reduced-motion: reduce` is set — the app-wide
 * `MotionConfigRoot` honours that preference and this component
 * inherits via framer-motion.
 */
export type BuddgyPose = 'greeting' | 'thinking' | 'celebrating' | 'pointing'
export type BuddgySize = 'xs' | 'sm' | 'md' | 'lg'
export type BuddgyPointDirection = 'left' | 'right' | 'down'

export interface BuddgyAvatarProps {
  pose?: BuddgyPose
  size?: BuddgySize
  /** Direction the arm points when `pose === 'pointing'`. Default 'down'. */
  pointDirection?: BuddgyPointDirection
  /** Disable the idle breathing loop (e.g. in a static preview). */
  still?: boolean
  className?: string
}

const SIZE_PX: Record<BuddgySize, number> = {
  xs: 32,
  sm: 44,
  md: 72,
  lg: 120,
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
      animate={still ? undefined : { scale: [1, 1.025, 1] }}
      transition={
        still
          ? undefined
          : { duration: 3.2, repeat: Infinity, ease: 'easeInOut', repeatType: 'loop' }
      }
      aria-hidden
    >
      <svg viewBox="0 0 100 100" width={px} height={px} className="overflow-visible">
        <defs>
          <radialGradient id="buddgyBody" cx="50%" cy="40%" r="65%">
            <stop offset="0%" stopColor="#FF6B6B" />
            <stop offset="65%" stopColor="var(--color-brand-red, #E50914)" />
            <stop offset="100%" stopColor="#B50612" />
          </radialGradient>
          <radialGradient id="buddgyHighlight" cx="35%" cy="30%" r="22%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.55)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
        </defs>

        {/* Celebration stars — only visible in celebrating pose. */}
        {pose === 'celebrating' ? <CelebrateStars /> : null}

        {/* Body: coin-shaped circle with a subtle inner rim. */}
        <circle cx="50" cy="52" r="38" fill="url(#buddgyBody)" />
        <circle
          cx="50"
          cy="52"
          r="32"
          fill="none"
          stroke="rgba(255,255,255,0.18)"
          strokeWidth="1.5"
          strokeDasharray="2 3"
        />

        {/* Soft highlight for depth */}
        <circle cx="50" cy="52" r="38" fill="url(#buddgyHighlight)" />

        {/* Cheeks (amber blush) */}
        <circle cx="30" cy="60" r="4" fill="var(--color-brand-amber, #F5A623)" opacity="0.55" />
        <circle cx="70" cy="60" r="4" fill="var(--color-brand-amber, #F5A623)" opacity="0.55" />

        {/* Eyes + mouth per pose */}
        {pose === 'greeting' ? <FaceGreeting /> : null}
        {pose === 'thinking' ? <FaceThinking /> : null}
        {pose === 'celebrating' ? <FaceCelebrating /> : null}
        {pose === 'pointing' ? <FacePointing /> : null}

        {/* Arms per pose */}
        {pose === 'celebrating' ? <ArmsUp /> : null}
        {pose === 'pointing' ? <ArmPointing direction={pointDirection} /> : null}
        {pose === 'thinking' ? <ArmChin /> : null}
      </svg>
    </motion.div>
  )
}

// ─── Face variants ─────────────────────────────────────────────────────

function FaceGreeting() {
  return (
    <g>
      {/* Eyes — open, friendly */}
      <Eye cx={40} cy={48} />
      <Eye cx={60} cy={48} />
      {/* Smile */}
      <path
        d="M 41 62 Q 50 70 59 62"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
    </g>
  )
}

function FaceThinking() {
  return (
    <g>
      {/* Eyes looking up-left */}
      <Eye cx={40} cy={48} pupilDx={-1.5} pupilDy={-1.5} />
      <Eye cx={60} cy={48} pupilDx={-1.5} pupilDy={-1.5} />
      {/* Small pursed mouth */}
      <path
        d="M 46 64 Q 50 66 54 64"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
    </g>
  )
}

function FaceCelebrating() {
  return (
    <g>
      {/* Closed happy eyes (upward arcs) */}
      <path
        d="M 36 48 Q 40 44 44 48"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M 56 48 Q 60 44 64 48"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      {/* Big open smile */}
      <path
        d="M 38 60 Q 50 74 62 60 Q 50 68 38 60 Z"
        fill="white"
      />
    </g>
  )
}

function FacePointing() {
  return (
    <g>
      {/* Eyes with a slight wink — right eye half-closed */}
      <Eye cx={40} cy={48} />
      <path
        d="M 56 48 Q 60 45 64 48"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      {/* Gentle smile */}
      <path
        d="M 42 62 Q 50 68 58 62"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
    </g>
  )
}

function Eye({
  cx,
  cy,
  pupilDx = 0,
  pupilDy = 0,
}: {
  cx: number
  cy: number
  pupilDx?: number
  pupilDy?: number
}) {
  return (
    <g>
      <circle cx={cx} cy={cy} r="4.5" fill="white" />
      <circle cx={cx + pupilDx} cy={cy + pupilDy} r="2.2" fill="#1a1a1a" />
      <circle cx={cx + pupilDx - 0.7} cy={cy + pupilDy - 0.7} r="0.7" fill="white" />
    </g>
  )
}

// ─── Arms ──────────────────────────────────────────────────────────────

function ArmsUp() {
  return (
    <g>
      {/* Left arm up */}
      <path
        d="M 18 45 Q 12 30 10 18"
        stroke="var(--color-brand-red, #E50914)"
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="10" cy="16" r="4" fill="var(--color-brand-red, #E50914)" />
      {/* Right arm up */}
      <path
        d="M 82 45 Q 88 30 90 18"
        stroke="var(--color-brand-red, #E50914)"
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="90" cy="16" r="4" fill="var(--color-brand-red, #E50914)" />
    </g>
  )
}

function ArmPointing({ direction }: { direction: BuddgyPointDirection }) {
  if (direction === 'left') {
    return (
      <g>
        <path
          d="M 18 55 Q 8 55 -2 58"
          stroke="var(--color-brand-red, #E50914)"
          strokeWidth="5"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="-2" cy="58" r="4" fill="var(--color-brand-red, #E50914)" />
      </g>
    )
  }
  if (direction === 'right') {
    return (
      <g>
        <path
          d="M 82 55 Q 92 55 102 58"
          stroke="var(--color-brand-red, #E50914)"
          strokeWidth="5"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="102" cy="58" r="4" fill="var(--color-brand-red, #E50914)" />
      </g>
    )
  }
  // down
  return (
    <g>
      <path
        d="M 50 88 Q 52 96 54 102"
        stroke="var(--color-brand-red, #E50914)"
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="54" cy="102" r="4" fill="var(--color-brand-red, #E50914)" />
    </g>
  )
}

function ArmChin() {
  // Hand at chin, thinking pose.
  return (
    <g>
      <path
        d="M 36 74 Q 38 70 44 68"
        stroke="var(--color-brand-red, #E50914)"
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="44" cy="68" r="3.5" fill="var(--color-brand-red, #E50914)" />
    </g>
  )
}

// ─── Celebration stars ─────────────────────────────────────────────────

function CelebrateStars() {
  return (
    <g>
      <Star cx={15} cy={20} r={2.5} color="var(--color-brand-amber, #F5A623)" />
      <Star cx={85} cy={22} r={3} color="var(--color-brand-amber, #F5A623)" />
      <Star cx={92} cy={55} r={2} color="var(--color-brand-amber, #F5A623)" />
      <Star cx={8} cy={55} r={2} color="var(--color-brand-amber, #F5A623)" />
    </g>
  )
}

function Star({ cx, cy, r, color }: { cx: number; cy: number; r: number; color: string }) {
  // Simple 4-point sparkle rendered as two crossed rounded rects.
  return (
    <g transform={`translate(${cx} ${cy})`}>
      <rect x={-r * 0.3} y={-r} width={r * 0.6} height={r * 2} rx={r * 0.3} fill={color} />
      <rect x={-r} y={-r * 0.3} width={r * 2} height={r * 0.6} rx={r * 0.3} fill={color} />
    </g>
  )
}
