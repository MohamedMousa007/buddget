'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const HEARTBEAT_INTERVAL_MS = 45_000
const HEARTBEAT_CHUNK_SEC = 45

export function AnalyticsHeartbeat({ userId }: { userId: string }) {
  const pathname = usePathname()
  const sentSession = useRef(false)

  useEffect(() => {
    const supabase = createClient()

    async function emit(type: string, metadata: Record<string, unknown> = {}) {
      const { error } = await supabase.from('app_analytics_events').insert({
        user_id: userId,
        event_type: type,
        metadata,
      })
      if (error) {
        console.warn('[analytics]', type, error.message)
      }
    }

    if (!sentSession.current) {
      sentSession.current = true
      void emit('session_start', { path: pathname })
    }

    const tick = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        void emit('heartbeat', {
          path: pathname,
          seconds: HEARTBEAT_CHUNK_SEC,
        })
      }
    }

    const id = window.setInterval(tick, HEARTBEAT_INTERVAL_MS)

    const onVis = () => {
      if (document.visibilityState === 'visible') {
        void emit('visibility_visible', { path: pathname })
      }
    }
    document.addEventListener('visibilitychange', onVis)

    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [userId, pathname])

  return null
}
