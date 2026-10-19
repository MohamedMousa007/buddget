'use client'

import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'

export type Tone = 'good' | 'warn' | 'bad' | 'brand' | 'neutral'

const VARIANT = { good: 'positive', warn: 'warning', bad: 'negative', brand: 'brand', neutral: 'muted' } as const

export function Pill({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <Badge variant={VARIANT[tone]}>{children}</Badge>
}

const STATUS_TONE: Record<string, Tone> = {
  active: 'good', trialing: 'brand', past_due: 'warn', canceled: 'neutral', expired: 'neutral', paused: 'neutral',
  open: 'warn', pending: 'brand', resolved: 'good', closed: 'neutral',
  low: 'neutral', normal: 'neutral', high: 'warn', urgent: 'bad',
  suspended: 'bad', draft: 'neutral', archived: 'neutral',
  confirmed: 'good', logged: 'good', notified: 'brand', rendered: 'good', tapped: 'good', paired: 'good',
  processing: 'warn', rejected: 'neutral', failed: 'bad', add_failed: 'bad',
}

export function StatusPill({ status }: { status: string | null | undefined }) {
  if (!status) return <Pill>—</Pill>
  return <Pill tone={STATUS_TONE[status] ?? 'neutral'}>{status.replace(/_/g, ' ')}</Pill>
}
