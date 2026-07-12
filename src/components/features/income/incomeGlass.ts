import type { CSSProperties } from 'react'

/** Glass card surface (summary, recurring, assign cards). Handoff §9. */
export const GLASS_CARD: CSSProperties = {
  background: 'linear-gradient(158deg, rgba(29,185,84,.09), rgba(18,18,24,.72) 54%), #0f0f15',
  border: '1px solid rgba(255,255,255,.08)',
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,.06)',
  borderRadius: 16,
}

/**
 * Recurring hero card — glassy surface tinted by the income-type accent (never
 * green; that's reserved for received/summary). Inset top highlight + soft outer
 * shadow give a subtle 3D lift. `accent` is the type's solid color (`colors.fg`).
 */
export function heroCardStyle(accent: string): CSSProperties {
  return {
    background: `linear-gradient(158deg, ${accent}22, rgba(255,255,255,.045) 55%), #0f0f15`,
    border: '1px solid rgba(255,255,255,.08)',
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,.07), 0 8px 24px -12px rgba(0,0,0,.6)',
    borderRadius: 16,
  }
}

/** Glassy green CTA — reserved for the positive "Mark received" action. */
export const GLASS_GREEN_BTN: CSSProperties = {
  background: 'linear-gradient(160deg, rgba(29,185,84,.28), rgba(29,185,84,.12))',
  border: '1px solid rgba(53,212,111,.5)',
  color: '#8FF0B4',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  borderRadius: 14,
}

/**
 * Neutral glass CTA — for edit/adjust actions on an already-received payday,
 * so the button never clashes with the green (received) chip above it.
 */
export const GLASS_NEUTRAL_BTN: CSSProperties = {
  background: 'linear-gradient(160deg, rgba(255,255,255,.15), rgba(255,255,255,.06))',
  border: '1px solid rgba(255,255,255,.2)',
  color: '#ECECF2',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  borderRadius: 14,
}
