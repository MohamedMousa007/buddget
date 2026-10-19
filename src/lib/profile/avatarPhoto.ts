/** Edge length of the stored profile photo. Small enough to sync as a ~60 KB data URL. */
export const AVATAR_OUTPUT_PX = 512
const OUTPUT_QUALITY = 0.86
/** Anything bigger than this is refused before decoding; ordinary camera photos are far below it. */
export const AVATAR_MAX_INPUT_BYTES = 25 * 1024 * 1024
export const AVATAR_MIN_ZOOM = 1
export const AVATAR_MAX_ZOOM = 4

const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

export type AvatarFileCheck = 'ok' | 'badType' | 'tooBig'

export function checkAvatarFile(file: { type: string; size: number }): AvatarFileCheck {
  if (!ACCEPTED_TYPES.has(file.type)) return 'badType'
  if (file.size > AVATAR_MAX_INPUT_BYTES) return 'tooBig'
  return 'ok'
}

export interface CropState {
  /** Natural size of the source image. */
  width: number
  height: number
  zoom: number
  /** -1 (left/top edge) .. 1 (right/bottom edge); the free movement left by the current zoom. */
  panX: number
  panY: number
}

export interface CropSquare {
  sx: number
  sy: number
  side: number
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** The square of the source image the circle currently frames. */
export function cropSquare({ width, height, zoom, panX, panY }: CropState): CropSquare {
  const side = Math.min(width, height) / clamp(zoom, AVATAR_MIN_ZOOM, AVATAR_MAX_ZOOM)
  return {
    side,
    sx: ((width - side) * (clamp(panX, -1, 1) + 1)) / 2,
    sy: ((height - side) * (clamp(panY, -1, 1) + 1)) / 2,
  }
}

/** Pan values after the image is dragged by `dxPx`/`dyPx` screen pixels while `frameDiameterPx` shows `side` source pixels. */
export function panAfterDrag(state: CropState, dxPx: number, dyPx: number, frameDiameterPx: number): Pick<CropState, 'panX' | 'panY'> {
  const { sx, sy, side } = cropSquare(state)
  const scale = frameDiameterPx / side
  const freeX = state.width - side
  const freeY = state.height - side
  const nx = clamp(sx - dxPx / scale, 0, freeX)
  const ny = clamp(sy - dyPx / scale, 0, freeY)
  return {
    panX: freeX > 0 ? (2 * nx) / freeX - 1 : 0,
    panY: freeY > 0 ? (2 * ny) / freeY - 1 : 0,
  }
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('decode'))
    img.src = src
  })
}

/** Renders the framed square to a 512 px JPEG data URL. Browser only. */
export function renderAvatarJpeg(img: HTMLImageElement, crop: CropState): string {
  const { sx, sy, side } = cropSquare(crop)
  const canvas = document.createElement('canvas')
  canvas.width = AVATAR_OUTPUT_PX
  canvas.height = AVATAR_OUTPUT_PX
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, AVATAR_OUTPUT_PX, AVATAR_OUTPUT_PX)
  ctx.drawImage(img, sx, sy, side, side, 0, 0, AVATAR_OUTPUT_PX, AVATAR_OUTPUT_PX)
  return canvas.toDataURL('image/jpeg', OUTPUT_QUALITY)
}
