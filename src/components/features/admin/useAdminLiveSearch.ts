'use client'

import { useEffect, useState } from 'react'
import { adminFetch } from './adminClient'
import { personLabel } from './format'

export const LIVE_MIN_CHARS = 2
const DEBOUNCE_MS = 250
const PER_SOURCE = 5

export interface LiveUser { id: string; primary: string; secondary: string | null }
export interface LiveTicket { id: string; number: number; subject: string; requester: string | null }

interface Settled { term: string; users: LiveUser[]; tickets: LiveTicket[]; failed: boolean }

/**
 * Users and tickets matching `query`, from the same admin routes their own views use (so the server enforces the
 * permission and masking). A source the role may not read is never requested. Debounced; a newer keystroke aborts the
 * request still in flight.
 */
export function useAdminLiveSearch(query: string, canUsers: boolean, canTickets: boolean) {
  const term = query.trim()
  const active = term.length >= LIVE_MIN_CHARS && (canUsers || canTickets)
  const [settled, setSettled] = useState<Settled | null>(null)

  useEffect(() => {
    if (!active) return
    const ctl = new AbortController()
    const timer = setTimeout(async () => {
      const q = encodeURIComponent(term)
      const [users, tickets] = await Promise.allSettled([
        canUsers ? adminFetch<{ rows: Array<{ id: string; email: string | null; name: string | null }> }>(`/api/admin/users?limit=${PER_SOURCE}&q=${q}`, { signal: ctl.signal }) : null,
        canTickets ? adminFetch<{ tickets: Array<{ id: string; number: number; subject: string; requester_email: string | null }> }>(`/api/admin/support/tickets?view=all&q=${q}`, { signal: ctl.signal }) : null,
      ])
      if (ctl.signal.aborted) return
      const failed = [users, tickets].some((r) => r.status === 'rejected')
      setSettled({
        term,
        failed,
        users: users.status === 'fulfilled' && users.value
          ? users.value.rows.slice(0, PER_SOURCE).map((u) => {
              const who = personLabel(u)
              return { id: u.id, primary: who.primary, secondary: who.secondary }
            })
          : [],
        tickets: tickets.status === 'fulfilled' && tickets.value
          ? tickets.value.tickets.slice(0, PER_SOURCE).map((t) => ({ id: t.id, number: t.number, subject: t.subject, requester: t.requester_email }))
          : [],
      })
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
      ctl.abort()
    }
  }, [active, term, canUsers, canTickets])

  const fresh = active && settled?.term === term ? settled : null
  return {
    active,
    loading: active && !fresh,
    failed: fresh?.failed ?? false,
    users: fresh?.users ?? [],
    tickets: fresh?.tickets ?? [],
  }
}
