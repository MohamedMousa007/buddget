'use client'

import { useState } from 'react'
import { useDismissGuard } from '@/components/modals/ModalShell'
import { UnsavedChangesDialog } from '@/components/features/expenses/UnsavedChangesDialog'
import { useGoalsLtCopy } from '@/lib/i18n/goalsLtCopy'

/** Sits inside ModalShell's guard context, so a backdrop tap, swipe down, Escape or Android back asks first too. */
function DiscardGuard({ onDismiss }: { onDismiss: () => boolean }) {
  useDismissGuard(onDismiss)
  return null
}

/**
 * "Discard this?" before a money sheet with typed data closes. `close` is for the sheet's X; render `prompt` inside the
 * sheet's ModalShell. With nothing typed both simply close.
 */
export function useDiscardPrompt(dirty: boolean, onClose: () => void) {
  const c = useGoalsLtCopy().discard
  const [asking, setAsking] = useState(false)
  const close = () => (dirty ? setAsking(true) : onClose())
  const onDismiss = () => {
    if (asking) { setAsking(false); return true }
    if (dirty) { setAsking(true); return true }
    return false
  }
  const prompt = (
    <>
      <DiscardGuard onDismiss={onDismiss} />
      <UnsavedChangesDialog open={asking} title={c.title} body={c.body} discardLabel={c.discard}
        onDiscard={() => { setAsking(false); onClose() }} onKeep={() => setAsking(false)} />
    </>
  )
  return { close, prompt }
}
