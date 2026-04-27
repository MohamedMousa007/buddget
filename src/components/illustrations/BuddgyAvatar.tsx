'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

/**
 * Buddgy — the app's AI guide character.
 *
 * Cartoonized robot face rendered via DiceBear's `bottts-neutral` style
 * (same family as the user profile avatars at `cartoonAvatars.ts`). A
 * fixed seed keeps the character identity stable across the app; the
 * `pose` prop layers a small mood badge so Buddgy can react without
 * the underlying face swapping out.
 *
 * Why DiceBear over a hand-drawn SVG: the user wants something with a
 * face, in the same family as the cartoon profile avatars, with an AI
 * (robot) feel rather than a generic mascot. `bottts-neutral` is the
 * DiceBear robot collection — friendly, readable at any size, and
 * fetched once per session (cached by the browser).
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

const BUDDGY_SEED = 'buddgy-pal'
const BUDDGY_BG = 'fee2e2'
const BUDDGY_AVATAR_URL = `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${BUDDGY_SEED}&backgroundColor=${BUDDGY_BG}&radius=50`

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
      {/* eslint-disable-next-line @next/next/no-img-element -- DiceBear returns SVG; next/image optimization is unnecessary and would require remote-pattern config. */}
      <img
        src={BUDDGY_AVATAR_URL}
        alt=""
        width={px}
        height={px}
        loading="lazy"
        decoding="async"
        className="block rounded-full"
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
