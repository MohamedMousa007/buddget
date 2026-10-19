import { describe, expect, it } from 'vitest'
import {
  AVATAR_BACKGROUNDS,
  AVATAR_GROUPS,
  AVATAR_PRESETS,
  avatarDataUri,
  avatarSvg,
  encodeAvatarId,
  parseAvatarId,
  resolveAvatarId,
} from '@/lib/profile/avatarArt'
import { resolveProfileAvatarSrc } from '@/lib/profile/avatarDisplay'
import { checkAvatarFile, cropSquare, panAfterDrag, AVATAR_MAX_INPUT_BYTES } from '@/lib/profile/avatarPhoto'
import { isValidImageDataUrl } from '@/lib/profile/validImageDataUrl'

function tagsBalance(svg: string): boolean {
  const stack: string[] = []
  for (const m of svg.matchAll(/<(\/?)([a-zA-Z]+)([^>]*?)(\/?)>/g)) {
    const [, closing, name, , selfClosing] = m
    if (selfClosing) continue
    if (closing) {
      if (stack.pop() !== name) return false
    } else {
      stack.push(name)
    }
  }
  return stack.length === 0
}

describe('avatar set', () => {
  it('ships 32 presets with unique ids across the three groups', () => {
    expect(AVATAR_PRESETS).toHaveLength(32)
    expect(new Set(AVATAR_PRESETS.map((p) => p.id)).size).toBe(32)
    for (const g of AVATAR_GROUPS) expect(AVATAR_PRESETS.some((p) => p.group === g)).toBe(true)
  })

  it('renders every preset as well-formed SVG with no stray values', () => {
    for (const p of AVATAR_PRESETS) {
      const svg = avatarSvg(p.id)!
      expect(svg.startsWith('<svg')).toBe(true)
      expect(svg.endsWith('</svg>')).toBe(true)
      expect(svg).not.toMatch(/undefined|NaN|null/)
      expect(tagsBalance(svg)).toBe(true)
    }
  })

  it('renders every preset on every background override', () => {
    for (const p of AVATAR_PRESETS) {
      for (const b of AVATAR_BACKGROUNDS) {
        const svg = avatarSvg(encodeAvatarId(p.id, b.key))!
        expect(svg).toContain(`fill="${b.main}"`)
      }
    }
  })

  it('produces distinct artwork per preset', () => {
    expect(new Set(AVATAR_PRESETS.map((p) => avatarSvg(p.id))).size).toBe(32)
  })

  it('returns an img-ready data URI and memoises it', () => {
    const a = avatarDataUri('nour')!
    expect(a.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true)
    expect(avatarDataUri('nour')).toBe(a)
  })

  it('parses and encodes the background suffix, ignoring unknown backgrounds', () => {
    expect(parseAvatarId('nour:violet')).toEqual({ id: 'nour', bg: 'violet' })
    expect(parseAvatarId('nour:nope')).toEqual({ id: 'nour' })
    expect(encodeAvatarId('nour', 'violet')).toBe('nour:violet')
    expect(encodeAvatarId('nour', 'nope')).toBe('nour')
  })

  it('maps legacy ids onto the new set, smileys onto the robots', () => {
    const ids = new Set(AVATAR_PRESETS.map((p) => p.id))
    for (const legacy of ['toon_a', 'toon_h', 'adv_felix', 'adv_luna', 'be_buddy', 'be_rex']) {
      const id = resolveAvatarId(legacy)!
      expect(ids.has(id)).toBe(true)
      expect(AVATAR_PRESETS.find((p) => p.id === id)!.group).not.toBe('crew')
      expect(resolveAvatarId(legacy)).toBe(id)
    }
    for (const smiley of ['fe_alpha', 'fe_beta', 'fe_gamma', 'fe_delta']) {
      expect(AVATAR_PRESETS.find((p) => p.id === resolveAvatarId(smiley))!.group).toBe('crew')
    }
  })

  it('rejects unknown and empty ids', () => {
    expect(resolveAvatarId('')).toBeNull()
    expect(resolveAvatarId(undefined)).toBeNull()
    expect(resolveAvatarId('preset_piggy')).toBeNull()
    expect(avatarDataUri('preset_piggy')).toBeNull()
  })
})

describe('resolveProfileAvatarSrc', () => {
  it('prefers an uploaded photo over a preset', () => {
    const photo = 'data:image/jpeg;base64,AAAA'
    expect(resolveProfileAvatarSrc({ avatar: photo, avatarPresetId: 'nour' })).toBe(photo)
  })
  it('falls back to the preset and then to null', () => {
    expect(resolveProfileAvatarSrc({ avatarPresetId: 'nour:sky' })).toBe(avatarDataUri('nour:sky'))
    expect(resolveProfileAvatarSrc({ avatarPresetId: 'toon_a' })).toBe(avatarDataUri('toon_a'))
    expect(resolveProfileAvatarSrc({})).toBeNull()
  })
  it('ignores a non-image avatar string', () => {
    expect(resolveProfileAvatarSrc({ avatar: 'javascript:alert(1)' })).toBeNull()
  })
})

describe('photo upload helpers', () => {
  it('classifies files', () => {
    expect(checkAvatarFile({ type: 'image/jpeg', size: 4_000_000 })).toBe('ok')
    expect(checkAvatarFile({ type: 'image/webp', size: 10 })).toBe('ok')
    expect(checkAvatarFile({ type: 'application/pdf', size: 10 })).toBe('badType')
    expect(checkAvatarFile({ type: 'image/heic', size: 10 })).toBe('badType')
    expect(checkAvatarFile({ type: 'image/png', size: AVATAR_MAX_INPUT_BYTES + 1 })).toBe('tooBig')
  })

  it('frames the centre square of a landscape photo at zoom 1', () => {
    const c = cropSquare({ width: 400, height: 200, zoom: 1, panX: 0, panY: 0 })
    expect(c).toEqual({ side: 200, sx: 100, sy: 0 })
  })

  it('zooming shrinks the framed square; pan reaches both edges', () => {
    const base = { width: 400, height: 200, zoom: 2 }
    expect(cropSquare({ ...base, panX: -1, panY: -1 })).toEqual({ side: 100, sx: 0, sy: 0 })
    expect(cropSquare({ ...base, panX: 1, panY: 1 })).toEqual({ side: 100, sx: 300, sy: 100 })
  })

  it('clamps out-of-range zoom and pan', () => {
    const c = cropSquare({ width: 200, height: 200, zoom: 99, panX: 5, panY: -5 })
    expect(c.side).toBe(50)
    expect(c.sx).toBe(150)
    expect(c.sy).toBe(0)
  })

  it('dragging the image right reveals more of its left side, and cannot overshoot', () => {
    const s = { width: 400, height: 200, zoom: 1, panX: 0, panY: 0 }
    const moved = panAfterDrag(s, 50, 0, 200)
    expect(moved.panX).toBeLessThan(0)
    expect(panAfterDrag(s, 99999, 0, 200).panX).toBe(-1)
    expect(panAfterDrag(s, -99999, 0, 200).panX).toBe(1)
    expect(panAfterDrag(s, 0, 80, 200).panY).toBe(0)
  })

  it('a square photo has no free movement at zoom 1', () => {
    const s = { width: 300, height: 300, zoom: 1, panX: 0, panY: 0 }
    expect(panAfterDrag(s, 40, 40, 200)).toEqual({ panX: 0, panY: 0 })
  })

  it('accepts the JPEG data URL the cropper produces', () => {
    expect(isValidImageDataUrl('data:image/jpeg;base64,/9j/4AAQSkZJRg==')).toBe(true)
  })
})
