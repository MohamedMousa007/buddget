import { useEffect, useMemo, useRef } from 'react'

/**
 * Re-entrancy guard for a submit that moves money. `claim()` is true exactly once per open: a second tap,
 * or the stale handler an exiting sheet still holds while it animates out, gets false and must return.
 * The guard re-arms when `open` turns true again (a page form re-arms by remounting); `release()` re-arms
 * it by hand after a claimed submit that failed without writing.
 */
export function useSubmitOnce(open = true) {
  const busy = useRef(false)
  useEffect(() => {
    if (open) busy.current = false
  }, [open])
  return useMemo(
    () => ({
      claim: () => {
        if (busy.current) return false
        busy.current = true
        return true
      },
      release: () => {
        busy.current = false
      },
    }),
    [],
  )
}
