'use client'

import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { flushFinanceNow } from '@/components/sync/SupabaseFinanceSync'
import { useActionToast } from '@/components/ui/ActionToast'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'

/**
 * Forces an immediate push of the local store to Supabase and confirms it.
 * Settings already auto-save (debounced/instant flush), but this gives the user
 * an explicit "it's saved everywhere now" affordance they asked for.
 */
export function SettingsSaveButton({ onSaved }: { onSaved?: () => void }) {
  const t = useT()
  const showToast = useActionToast()
  const [busy, setBusy] = useState(false)

  const onSave = async () => {
    if (busy) return
    setBusy(true)
    try {
      await flushFinanceNow()
      onSaved?.()
      showToast(t.common.savedSynced)
    } catch {
      // flush is best-effort; the next auto-flush will retry. Don't toast success.
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={onSave}
      disabled={busy}
      aria-label={t.common.save}
      className={cn(
        'flex h-11 min-w-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold',
        'bg-[var(--color-brand-red)] text-white transition-colors',
        'hover:bg-[var(--color-brand-red-hover)] active:scale-95 disabled:opacity-60',
      )}
    >
      {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
      <span>{t.common.save}</span>
    </button>
  )
}
