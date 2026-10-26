'use client'

import { Trash2 } from 'lucide-react'
import { DeleteAccountDialog } from '@/components/features/profile/DeleteAccountDialog'
import { AccountDeletedScreen } from '@/components/features/profile/AccountDeletedScreen'
import { Button } from '@/components/ui/button'
import { useProfilePage } from '@/hooks/useProfilePage'
import { useSettingsHubCopy } from '@/lib/i18n/settingsHubCopy'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { useEffect } from 'react'

/** Account deletion as its own call to action, apart from export and backup. Signed-in users only. */
export function DeleteAccountCta({ p }: { p: ReturnType<typeof useProfilePage> }) {
  const copy = useSettingsHubCopy()
  const sheet = useSettingsStore((s) => s.settingsSheet)
  const openSheet = useSettingsStore((s) => s.openSettingsSheet)
  useEffect(() => {
    if (sheet === 'deleteAccount') {
      openSheet(null)
      p.openDeleteDialog()
    }
  }, [sheet, openSheet, p])

  return (
    <section data-setting-id="deleteAccount" className="space-y-2 pt-2">
      <Button variant="outline" size="cta-block" onClick={p.openDeleteDialog} className="border-[var(--color-brand-red)]/30 text-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-soft)] hover:text-[var(--color-brand-red)]">
        <Trash2 className="size-4" />{copy.data.deleteCta}
      </Button>
      <p className="px-1 text-center text-xs text-[var(--color-brand-text-muted)]">{copy.data.deleteHint}</p>
      <DeleteAccountDialog open={p.deleteOpen} onClose={p.closeDeleteDialog} onConfirm={p.confirmDelete} inProgress={p.deleting} error={p.deleteError} reauthNeeded={p.reauthNeeded} />
      {p.deleteSuccess ? <AccountDeletedScreen /> : null}
    </section>
  )
}
