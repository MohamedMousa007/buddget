import type { CSSProperties } from 'react'

/** Small-caps eyebrow label, per docs/DESIGN_SYSTEM.md "Section Label" scale guidance. */
export const micro: CSSProperties = {
  fontSize: 10, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--color-brand-text-muted)',
}
