'use client'

import { Pencil, RotateCcw, Trash2, XCircle } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { useConfirm } from '@/components/ui/dialog/DialogProvider'
import type { Subscription } from '@/lib/store/types'

export function SubscriptionCardMenu({
  sub,
  onEdit,
  onClose,
  cancelSubscription,
  deleteSubscription,
  reactivateSubscription,
}: {
  sub: Subscription
  onEdit: () => void
  onClose: () => void
  cancelSubscription: (id: string) => void
  deleteSubscription: (id: string) => void
  reactivateSubscription: (id: string) => void
}) {
  const t = useT()
  const confirm = useConfirm()
  return (
    <div
      className="absolute end-2 top-10 z-10 min-w-[10rem] rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] shadow-lg py-1 text-sm"
      role="menu"
    >
      <button
        type="button"
        className="flex items-center gap-2 w-full px-3 py-2 hover:bg-[var(--color-brand-elevated)]"
        onClick={() => {
          onClose()
          onEdit()
        }}
      >
        <Pencil className="w-4 h-4" /> {t.subscriptions.editSubscription}
      </button>
      {sub.status === 'active' || sub.status === 'trial' || sub.status === 'paused' ? (
        <button
          type="button"
          className="flex items-center gap-2 w-full px-3 py-2 hover:bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-secondary)]"
          onClick={async () => {
            if (await confirm({ title: t.subscriptions.confirmCancel, destructive: true })) {
              cancelSubscription(sub.id)
            }
            onClose()
          }}
        >
          <XCircle className="w-4 h-4" /> {t.subscriptions.cancelSubscriptionAction}
        </button>
      ) : (
        <button
          type="button"
          className="flex items-center gap-2 w-full px-3 py-2 hover:bg-[var(--color-brand-elevated)]"
          onClick={() => {
            reactivateSubscription(sub.id)
            onClose()
          }}
        >
          <RotateCcw className="w-4 h-4" /> {t.subscriptions.reactivate}
        </button>
      )}
      <button
        type="button"
        className="flex items-center gap-2 w-full px-3 py-2 hover:bg-[var(--color-brand-elevated)] text-[var(--color-brand-red)]"
        onClick={async () => {
          if (await confirm({ title: t.subscriptions.confirmDeleteSubscription, destructive: true })) {
            deleteSubscription(sub.id)
          }
          onClose()
        }}
      >
        <Trash2 className="w-4 h-4" /> {t.subscriptions.deleteSubscription}
      </button>
    </div>
  )
}
