'use client'

import { useCallback, useState } from 'react'
import { useActionToast } from '@/components/ui/ActionToast'
import { useConfirm } from '@/components/ui/dialog/DialogProvider'
import { adminPost, errorMessage } from './adminClient'

interface RunOptions {
  /** Ask before doing it. */
  confirm?: { title: string; body?: string; destructive?: boolean; confirmLabel?: string }
  success?: string
  /** Called with the parsed response once the server accepted the action. */
  then?: (res: never) => void
}

/** POSTs an admin action with an optional confirmation, a success toast and a busy flag. */
export function useAdminAction(path: string, onDone?: () => void | Promise<void>) {
  const toast = useActionToast()
  const confirm = useConfirm()
  const [busy, setBusy] = useState<string | null>(null)

  const run = useCallback(
    async (key: string, body: Record<string, unknown>, opts: RunOptions = {}): Promise<boolean> => {
      if (opts.confirm && !(await confirm(opts.confirm))) return false
      setBusy(key)
      try {
        const res = await adminPost<never>(path, body)
        opts.then?.(res)
        toast(opts.success ?? 'Done')
        await onDone?.()
        return true
      } catch (e) {
        toast(errorMessage(e))
        return false
      } finally {
        setBusy(null)
      }
    },
    [path, onDone, confirm, toast],
  )

  return { run, busy }
}
