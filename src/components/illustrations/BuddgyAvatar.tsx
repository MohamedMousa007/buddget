'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

/**
 * Buddgy — the app's AI guide character.
 *
 * Pixel-art helmeted robot with the brand "B" mark on the visor — the
 * canonical Buddgy design. Loaded as a static SVG from `/buddgy.svg`
 * (scales crisply at any size thanks to `shape-rendering: crispEdges`).
 *
 * The `pose` prop tweaks a small mood badge that overlays the avatar's
 * lower-right corner so Buddgy can react (greeting / thinking /
 * celebrating / pointing) without the underlying face changing.
 */
export type BuddgyPose = 'greeting' | 'thinking' | 'celebrating' | 'pointing'
export type BuddgySize = 'xs' | 'sm' | 'md' | 'lg'
export type BuddgyPointDirection = 'left' | 'right' | 'down'

export interface BuddgyAvatarProps {
  pose?: BuddgyPose
  size?: BuddgySize
  /** Direction the accent emoji points when `pose === 'pointing'`. */
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

const POSE_BADGE: Record<BuddgyPose, string | null> = {
  greeting: null,
  thinking: '💭',
  celebrating: '🎉',
  pointing: '👉',
}

export function BuddgyAvatar({
  pose = 'greeting',
  size = 'sm',
  pointDirection = 'down',
  still = false,
  className,
}: BuddgyAvatarProps) {
  const px = SIZE_PX[size]
  const badge = POSE_BADGE[pose]
  const badgeRotate =
    pose === 'pointing'
      ? pointDirection === 'left'
        ? -90
        : pointDirection === 'right'
          ? 90
          : 0
      : 0

  return (
    <motion.div
      className={cn('relative inline-block', className)}
      style={{ width: px, height: px }}
      animate={still ? undefined : { scale: [1, 1.025, 1] }}
      transition={
        still
          ? undefined
          : { duration: 4, repeat: Infinity, ease: 'easeInOut', repeatType: 'loop' }
      }
      aria-hidden
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- static local SVG, next/image optimization adds nothing. */}
      <img
        src="/buddgy.svg"
        alt=""
        width={px}
        height={px}
        decoding="async"
        className="block"
        style={{ imageRendering: 'pixelated' }}
      />
      {badge ? (
        <span
          className="absolute -bottom-1 -end-1 flex items-center justify-center rounded-full bg-[var(--color-brand-card)] border border-[var(--color-brand-border)] shadow-sm"
          style={{
            width: Math.max(18, Math.round(px * 0.34)),
            height: Math.max(18, Math.round(px * 0.34)),
            fontSize: Math.max(11, Math.round(px * 0.2)),
            transform: `rotate(${badgeRotate}deg)`,
          }}
        >
          {badge}
        </span>
      ) : null}
    </motion.div>
  )
}
