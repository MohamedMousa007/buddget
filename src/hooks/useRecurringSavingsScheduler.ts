'use client'

import { useEffect } from 'react'
import { format } from 'date-fns'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { postDueRecurringSavings } from '@/lib/savings/postRecurringSavings'

/** Posts due recurring savings deposits once data has loaded, then every minute (see `postDueRecurringSavings`). */
export function useRecurringSavingsScheduler() {
  const dataReady = useFinanceStore((s) => s.dataReady)
  useEffect(() => {
    if (!dataReady) return
    const tick = () => postDueRecurringSavings(format(new Date(), 'yyyy-MM-dd'))

    tick()
    const id = setInterval(tick, 60_000)
    return () => clearInterval(id)
  }, [dataReady])
}
