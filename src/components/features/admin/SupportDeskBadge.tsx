'use client'

import { useCallback, useEffect, useState } from 'react'
import { useForegroundPoll } from '@/hooks/useForegroundPoll'
import { adminFetch } from './adminClient'
import { Pill } from './ui/Pill'

const POLL_MS = 60_000

/**
 * The staff alert for new tickets and user replies: the count waiting on the team next to Support desk, red while any
 * of them holds a message no teammate has opened. Refreshes every minute while the portal is in front.
 */
export function SupportDeskBadge() {
  const [summary, setSummary] = useState<{ needsReply: number; unread: number } | null>(null)
  const load = useCallback(() => {
    adminFetch<{ needsReply: number; unread: number }>('/api/admin/support/summary').then(setSummary, () => undefined)
  }, [])
  useEffect(load, [load])
  useForegroundPoll(load, POLL_MS, true)
  if (!summary?.needsReply) return null
  return (
    <span className="ms-auto" aria-label={`${summary.needsReply} waiting for a reply${summary.unread ? `, ${summary.unread} unread` : ''}`}>
      <Pill tone={summary.unread ? 'bad' : 'neutral'}>{summary.needsReply}</Pill>
    </span>
  )
}
