'use client'

import { useState } from 'react'
import {
  ArrowDownUp, BarChart3, Brain, Compass, CreditCard, Landmark, Layers, Pencil, PieChart, PiggyBank, Receipt, Repeat, Settings, Target, Trash2, User, Wallet,
  type LucideIcon,
} from 'lucide-react'
import { AfterState } from '@/components/features/ai-chat/cards/AfterState'
import { BuddgyActionCard, type CardAction } from '@/components/features/ai-chat/cards/BuddgyActionCard'
import { EditFields } from '@/components/features/ai-chat/cards/EditFields'
import { BatchBody } from '@/components/features/ai-chat/cards/bodies/BatchBody'
import { ChangeBody } from '@/components/features/ai-chat/cards/bodies/ChangeBody'
import { CreateBody } from '@/components/features/ai-chat/cards/bodies/CreateBody'
import { GoBody } from '@/components/features/ai-chat/cards/bodies/GoBody'
import { MoveBody } from '@/components/features/ai-chat/cards/bodies/MoveBody'
import { RecordBody } from '@/components/features/ai-chat/cards/bodies/RecordBody'
import { RemoveBody } from '@/components/features/ai-chat/cards/bodies/RemoveBody'
import { StatusBody } from '@/components/features/ai-chat/cards/bodies/StatusBody'
import type { ProposalState } from '@/lib/buddgy/client/chatTypes'
import { patternOf, entityOf } from '@/lib/buddgy/tools/pattern'
import type { ProposalPattern } from '@/lib/buddgy/tools/proposal'
import type { ToolDomain } from '@/lib/buddgy/tools/spec'
import { money } from '@/lib/buddgy/tools/writeKit'
import { useBuddgyCardCopy } from '@/lib/i18n/buddgyCardCopy'
import { useBuddgyChatCopy } from '@/lib/i18n/buddgyChatCopy'

const DOMAIN_ICON: Record<ToolDomain, LucideIcon> = {
  expenses: Receipt,
  income: Wallet,
  debts: Landmark,
  subscriptions: Repeat,
  goals: Target,
  savings: PiggyBank,
  budget: PieChart,
  payments: CreditCard,
  settings: Settings,
  profile: User,
  memory: Brain,
  navigation: Compass,
  reports: BarChart3,
}

const PATTERN_ICON: Partial<Record<ProposalPattern, LucideIcon>> = { batch: Layers, change: Pencil, move: ArrowDownUp, remove: Trash2 }

export interface ProposalCardProps {
  state: ProposalState
  onApply: () => void
  onDismiss: () => void
  /** `rowKey` names the batch row a picker or edit belongs to. */
  onRevise: (patch: Record<string, string>, rowKey?: string) => void
  onUndo: () => void
  onRemoveRow?: (rowKey: string) => void
  onRetry?: () => void
}

/**
 * One pending change in the Buddgy action-card shell, with the body its pattern calls for (record, batch, create,
 * change, move, remove, status, go). Every body is drawn from the proposal's own preview, so no tool is special-cased here.
 */
export function ProposalCard({ state, onApply, onDismiss, onRevise, onUndo, onRemoveRow, onRetry }: ProposalCardProps) {
  const chat = useBuddgyChatCopy()
  const copy = useBuddgyCardCopy()
  const [editing, setEditing] = useState(false)
  const { proposal, status } = state
  const { preview } = proposal

  if (status !== 'pending') return <AfterState state={state} onUndo={onUndo} onRetry={onRetry} />

  const pattern = patternOf(proposal)
  const danger = pattern === 'remove' || preview.tone === 'danger'
  const tone = danger ? 'danger' : preview.tone
  const items = preview.items ?? []
  const editable = pattern !== 'batch' && (preview.fields?.length ?? 0) > 0
  const revise = (patch: Record<string, string>) => onRevise(patch)

  const label =
    copy.primary({
      tool: proposal.tool,
      pattern,
      entity: preview.entity ?? entityOf(proposal.tool),
      count: items.length,
      amount: preview.amount !== undefined && preview.currency ? money(preview.amount, preview.currency) : undefined,
    }) ?? chat.approveRisk(proposal.risk, tone)
  const primary = pattern === 'go' ? undefined : { label, onClick: onApply, danger, disabled: pattern === 'batch' && items.length === 0 }
  const secondary: CardAction[] = [
    ...(editable && !editing ? [{ label: chat.edit, onClick: () => setEditing(true) }] : []),
    { label: danger ? copy.keep : chat.dismiss, onClick: onDismiss },
  ]

  const body = (() => {
    if (editing && preview.fields) {
      return (
        <EditFields
          fields={preview.fields}
          error={state.message}
          onSave={(patch) => {
            onRevise(patch)
            setEditing(false)
          }}
          onCancel={() => setEditing(false)}
        />
      )
    }
    switch (pattern) {
      case 'record': return <RecordBody preview={preview} onRevise={revise} />
      case 'batch': return <BatchBody items={items} onRemoveRow={(k) => onRemoveRow?.(k)} onRevise={(patch, k) => onRevise(patch, k)} />
      case 'create': return <CreateBody preview={preview} onRevise={revise} />
      case 'move': return <MoveBody preview={preview} />
      case 'remove': return <RemoveBody preview={preview} />
      case 'status': return <StatusBody proposal={proposal} />
      case 'go': return <GoBody preview={preview} onGo={onApply} />
      default: return <ChangeBody preview={preview} />
    }
  })()

  return (
    <BuddgyActionCard
      tone={tone}
      icon={PATTERN_ICON[pattern] ?? DOMAIN_ICON[preview.domain]}
      title={preview.title}
      meta={pattern === 'batch' && preview.amount !== undefined && preview.currency ? money(preview.amount, preview.currency) : undefined}
      primary={editing ? undefined : primary}
      secondary={editing ? [] : secondary}
      note={pattern === 'batch' && items.length > 1 ? copy.batch.note : undefined}
    >
      {body}
      {!editing && state.message ? <p role="alert" className="px-1 text-xs text-[var(--color-brand-red)]">{state.message}</p> : null}
    </BuddgyActionCard>
  )
}
