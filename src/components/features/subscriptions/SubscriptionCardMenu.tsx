'use client'

import { Pencil, RotateCcw, Trash2, XCircle } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { CardActionMenu, type CardMenuItem } from '@/components/ui/CardActionMenu'
import { useConfirm } from '@/components/ui/dialog/DialogProvider'
import type { Subscription } from '@/lib/store/types'

/**
 * The ⋮ menu on a subscription card.
 *
 * This used to be a bespoke absolutely-positioned panel with its own item markup.
 * It now only decides *which items* a subscription offers — cancel and reactivate
 * are mutually exclusive, and both destructive actions are confirmed first — and
 * hands them to {@link CardActionMenu}, which every other card already uses.
 */
export function SubscriptionCardMenu({
  sub,
  anchor,
  onEdit,
  onClose,
  cancelSubscription,
  deleteSubscription,
  reactivateSubscription,
}: {
  sub: Subscription
  /** The ⋮ trigger's rect, captured on click. */
  anchor: DOMRect | null
  onEdit: () => void
  onClose: () => void
  cancelSubscription: (id: string) => void
  deleteSubscription: (id: string) => void
  reactivateSubscription: (id: string) => void
}) {
  const t = useT()
  const confirm = useConfirm()

  const cancellable =
    sub.status === 'active' || sub.status === 'trial' || sub.status === 'paused'

  const items: CardMenuItem[] = [
    { label: t.subscriptions.editSubscription, icon: <Pencil size={17} />, onSelect: onEdit },
    cancellable
      ? {
          label: t.subscriptions.cancelSubscriptionAction,
          icon: <XCircle size={17} />,
          onSelect: () => {
            void (async () => {
              if (await confirm({ title: t.subscriptions.confirmCancel, destructive: true })) {
                cancelSubscription(sub.id)
              }
            })()
          },
        }
      : {
          label: t.subscriptions.reactivate,
          icon: <RotateCcw size={17} />,
          onSelect: () => reactivateSubscription(sub.id),
        },
    {
      label: t.subscriptions.deleteSubscription,
      icon: <Trash2 size={17} />,
      destructive: true,
      onSelect: () => {
        void (async () => {
          if (
            await confirm({ title: t.subscriptions.confirmDeleteSubscription, destructive: true })
          ) {
            deleteSubscription(sub.id)
          }
        })()
      },
    },
  ]

  return <CardActionMenu anchor={anchor} onClose={onClose} items={items} />
}
