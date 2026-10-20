'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { createAnalyticsBuffer } from '@/lib/analytics/buffer'
import { createClient } from '@/lib/supabase/client'

const FLUSH_INTERVAL_MS = 120_000

/**
 * Activity reporting: visible time, session starts and page visits are buffered and sent as one small batch every
 * couple of minutes and whenever the app is hidden (one upsert per user per day on the server).
 */
export function AnalyticsHeartbeat({ userId }: { userId: string }) {
  const pathname = usePathname()
  const buffer = useRef<ReturnType<typeof createAnalyticsBuffer> | null>(null)

  useEffect(() => {
    const supabase = createClient()
    const buf = createAnalyticsBuffer({
      send: async (report) => {
        const { error } = await supabase.rpc('analytics_touch', { p_seconds: report.seconds, p_sessions: report.sessions, p_paths: report.paths })
        return !error
      },
    })
    buffer.current = buf
    buf.startSession()
    const visible = () => document.visibilityState === 'visible'
    buf.setVisible(visible())

    const onVisibility = () => {
      buf.setVisible(visible())
      if (!visible()) void buf.flush()
    }
    const onHide = () => void buf.flush()
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onHide)
    const id = window.setInterval(() => {
      if (visible()) void buf.flush()
    }, FLUSH_INTERVAL_MS)

    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onHide)
      void buf.flush()
      buffer.current = null
    }
  }, [userId])

  useEffect(() => {
    buffer.current?.visit(pathname)
  }, [pathname, userId])

  return null
}
