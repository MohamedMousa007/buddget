import type { CSSProperties } from 'react'
import type { IncomeOccurrenceStatus } from '@/lib/utils/incomeOccurrences'

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
 * Recurring hero card — flat glassy surface with depth (no green gradient), so it
 * reads distinct from the green summary hero. Inset top highlight + soft outer
 * shadow give a subtle 3D lift.
 */
export const HERO_CARD: CSSProperties = {
  background: 'linear-gradient(0deg, rgba(255,255,255,.045), rgba(255,255,255,.045)), #0f0f15',
  border: '1px solid rgba(255,255,255,.08)',
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,.07), 0 8px 24px -12px rgba(0,0,0,.6)',
  borderRadius: 16,
}

/** Glassy green CTA (Mark received, Save). */
export const GLASS_GREEN_BTN: CSSProperties = {
  background: 'linear-gradient(160deg, rgba(29,185,84,.28), rgba(29,185,84,.12))',
  border: '1px solid rgba(53,212,111,.5)',
  color: '#8FF0B4',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  borderRadius: 14,
}

/** Accent per payday status — filled dot color; awaiting renders hollow. */
export const OCC_STATUS_COLOR: Record<IncomeOccurrenceStatus, string> = {
  received: '#35D46F',
  late: '#FFB13D',
  partial: '#7DB6FF',
  missed: '#E50914',
  awaiting: '#5A5A66',
}
