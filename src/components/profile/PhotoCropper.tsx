'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { IconButton } from '@/components/ui/IconButton'
import { useT } from '@/lib/i18n'
import {
  AVATAR_MAX_ZOOM,
  AVATAR_MIN_ZOOM,
  cropSquare,
  panAfterDrag,
  type CropState,
} from '@/lib/profile/avatarPhoto'

const FRAME_PX = 264
const CIRCLE_PX = 224
const ZOOM_STEP = 0.25
const NUDGE_PX = 12

interface PhotoCropperProps {
  src: string
  /** Fires once the image has decoded, then on every pan or zoom. */
  onChange: (crop: CropState) => void
}

/**
 * Frames a photo inside a circle: drag to move, +/- or the slider to zoom. It only
 * tracks the framing; {@link renderAvatarJpeg} turns that into the stored image.
 */
export function PhotoCropper({ src, onChange }: PhotoCropperProps) {
  const t = useT()
  const [crop, setCrop] = useState<CropState | null>(null)
  const drag = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (crop) onChange(crop)
  }, [crop, onChange])

  const apply = useCallback((patch: (c: CropState) => Partial<CropState>) => {
    setCrop((c) => (c ? { ...c, ...patch(c) } : c))
  }, [])

  const zoomTo = (z: number) =>
    apply(() => ({ zoom: Math.min(AVATAR_MAX_ZOOM, Math.max(AVATAR_MIN_ZOOM, z)) }))

  const nudge = (dx: number, dy: number) => apply((c) => panAfterDrag(c, dx, dy, CIRCLE_PX))

  let imgStyle: React.CSSProperties | undefined
  if (crop) {
    const { sx, sy, side } = cropSquare(crop)
    const scale = CIRCLE_PX / side
    imgStyle = {
      width: crop.width * scale,
      height: crop.height * scale,
      left: (FRAME_PX - CIRCLE_PX) / 2 - sx * scale,
      top: (FRAME_PX - CIRCLE_PX) / 2 - sy * scale,
    }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        role="group"
        aria-label={t.profile.avatarFrameTitle}
        tabIndex={0}
        className="relative touch-none select-none overflow-hidden rounded-2xl bg-[var(--color-brand-sunken)] outline-none focus-visible:ring-3 focus-visible:ring-[var(--color-brand-focus)]/50"
        style={{ width: FRAME_PX, height: FRAME_PX }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          drag.current = { x: e.clientX, y: e.clientY }
        }}
        onPointerMove={(e) => {
          if (!drag.current) return
          const dx = e.clientX - drag.current.x
          const dy = e.clientY - drag.current.y
          drag.current = { x: e.clientX, y: e.clientY }
          nudge(dx, dy)
        }}
        onPointerUp={() => { drag.current = null }}
        onPointerCancel={() => { drag.current = null }}
        onKeyDown={(e) => {
          const step = { ArrowLeft: [NUDGE_PX, 0], ArrowRight: [-NUDGE_PX, 0], ArrowUp: [0, NUDGE_PX], ArrowDown: [0, -NUDGE_PX] }[e.key]
          if (step) { e.preventDefault(); nudge(step[0], step[1]) }
          if (e.key === '+' || e.key === '=') zoomTo((crop?.zoom ?? 1) + ZOOM_STEP)
          if (e.key === '-') zoomTo((crop?.zoom ?? 1) - ZOOM_STEP)
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          draggable={false}
          className="pointer-events-none absolute max-w-none"
          style={imgStyle}
          onLoad={(e) => {
            const img = e.currentTarget
            setCrop({ width: img.naturalWidth, height: img.naturalHeight, zoom: 1.2, panX: 0, panY: 0 })
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-full border-2 border-white shadow-[0_0_0_999px_rgb(0_0_0/0.55)]"
          style={{ width: CIRCLE_PX, height: CIRCLE_PX, left: (FRAME_PX - CIRCLE_PX) / 2, top: (FRAME_PX - CIRCLE_PX) / 2 }}
        />
      </div>

      <div className="flex w-full max-w-[264px] items-center gap-2">
        <IconButton aria-label={t.profile.avatarZoomOut} variant="tinted" shape="round" onClick={() => zoomTo((crop?.zoom ?? 1) - ZOOM_STEP)}>
          <Minus />
        </IconButton>
        <input
          type="range"
          min={AVATAR_MIN_ZOOM}
          max={AVATAR_MAX_ZOOM}
          step={0.05}
          value={crop?.zoom ?? 1}
          aria-label={t.profile.avatarFrameTitle}
          onChange={(e) => zoomTo(Number(e.target.value))}
          className="h-11 min-w-0 flex-1 accent-[var(--color-brand-primary)]"
        />
        <IconButton aria-label={t.profile.avatarZoomIn} variant="tinted" shape="round" onClick={() => zoomTo((crop?.zoom ?? 1) + ZOOM_STEP)}>
          <Plus />
        </IconButton>
      </div>
    </div>
  )
}
