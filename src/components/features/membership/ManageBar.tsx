import type { ReactNode } from 'react'
import { ArrowRightLeft, CreditCard, ReceiptText, RotateCcw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import s from './membership.module.css'

export type ManageActionKind = 'plan' | 'manage' | 'restore' | 'receipts'

const ICON = { plan: ArrowRightLeft, manage: CreditCard, restore: RotateCcw, receipts: ReceiptText } as const

export interface ManageAction {
  kind: ManageActionKind
  label: string
  onClick: () => void
  disabled?: boolean
}

export interface ManageBarProps {
  /** Accessible name of the group: "Manage subscription". */
  label: string
  /** "Renews 17 Nov 2027 · EGP 499 / yr": <b> marks the emphasis. */
  status: ReactNode
  /** "Active" (positive), "Day 4 of 30" (brand), or a warning. */
  pill?: { label: ReactNode; tone: 'positive' | 'brand' | 'warn' }
  /** Four actions in order: plan (drawn in teal), manage, restore, receipts. */
  actions: readonly ManageAction[]
  className?: string
}

/** The slim manage bar: one status line, then the four things a member can do with a subscription. */
export function ManageBar({ label, status, pill, actions, className }: ManageBarProps) {
  return (
    <div role="group" aria-label={label} className={cn(s.mbar, className)}>
      <div className={s.mbarTop}>
        <span dir="auto">{status}</span>
        {pill ? <Badge tone={pill.tone} size="sm" bordered={false}>{pill.label}</Badge> : null}
      </div>
      <div className={s.mbarRow}>
        {actions.map((a) => {
          const Icon = ICON[a.kind]
          return (
            <button key={a.kind} type="button" onClick={a.onClick} disabled={a.disabled} className={cn(s.m4, a.kind === 'plan' && s.m4Pri)} data-action={a.kind} data-raw-button-ok="a cell of the manage bar: icon over label, divided by hairlines">
              <Icon aria-hidden />
              <span dir="auto">{a.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
