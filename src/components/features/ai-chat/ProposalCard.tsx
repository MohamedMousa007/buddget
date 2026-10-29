'use client'

import { useState } from 'react'
import {
  BarChart3, Brain, Check, Compass, CreditCard, Landmark, PieChart, PiggyBank, Receipt, Repeat, Settings, Target, Undo2, User, Wallet,
  type LucideIcon,
} from 'lucide-react'
import { AmountField } from '@/components/ui/AmountField'
import { Button } from '@/components/ui/button'
import { DatePickerField } from '@/components/ui/DatePickerField'
import { FactsTable } from '@/components/ui/FactsTable'
import { Input } from '@/components/ui/input'
import { SelectField } from '@/components/ui/SelectField'
import type { ProposalState } from '@/lib/buddgy/client/chatTypes'
import type { EditableField } from '@/lib/buddgy/tools/proposal'
import type { ToolDomain } from '@/lib/buddgy/tools/spec'
import { useBuddgyChatCopy } from '@/lib/i18n/buddgyChatCopy'
import { cn } from '@/lib/utils'

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

const TONE_HEAD = {
  add: 'bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary-ink)]',
  change: 'bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-primary)]',
  danger: 'bg-[var(--color-brand-red-soft)] text-[var(--color-brand-red)]',
} as const

function FieldControl({ field, value, onChange }: { field: EditableField; value: string; onChange: (v: string) => void }) {
  if (field.kind === 'amount') return <AmountField value={value} onChange={onChange} currency={field.currency} label={field.label} className="bg-[var(--color-brand-elevated)]" />
  if (field.kind === 'date') return <DatePickerField value={value} onChange={onChange} />
  if (field.kind === 'select') return <SelectField value={value} onChange={onChange} items={field.options ?? []} aria-label={field.label} />
  return <Input size="brand" value={value} onChange={(e) => onChange(e.target.value)} aria-label={field.label} />
}

export interface ProposalCardProps {
  state: ProposalState
  onApply: () => void
  onDismiss: () => void
  onRevise: (patch: Record<string, string>) => void
  onUndo: () => void
}

/**
 * One pending change, drawn from the proposal's own preview data. The same card serves every
 * tool: a header, the facts, optional editable fields, and the approve / edit / skip actions.
 */
export function ProposalCard({ state, onApply, onDismiss, onRevise, onUndo }: ProposalCardProps) {
  const copy = useBuddgyChatCopy()
  const { proposal, status } = state
  const { preview } = proposal
  const Icon = DOMAIN_ICON[preview.domain]
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Record<string, string>>({})

  if (status !== 'pending') {
    const done = status === 'applied'
    return (
      <div className="flex min-h-11 items-center gap-2 rounded-xl border border-[var(--color-brand-border)] px-3 py-2 text-[13px]">
        <span className={cn('flex size-6 shrink-0 items-center justify-center rounded-full', done ? 'bg-[var(--color-brand-green-soft)] text-[var(--color-brand-green)]' : 'bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-muted)]')}>
          {done ? <Check className="size-3.5" aria-hidden /> : <Icon className="size-3.5" aria-hidden />}
        </span>
        <span className="min-w-0 flex-1 truncate text-[var(--color-brand-text-secondary)]">
          {copy.statuses[status]}
          {state.message ? ` · ${state.message}` : ''}
        </span>
        {done && state.undo ? (
          <Button variant="ghost" size="touch" onClick={onUndo} className="shrink-0 px-3 text-[13px]">
            <Undo2 aria-hidden />
            {copy.undo}
          </Button>
        ) : null}
      </div>
    )
  }

  const editable = (preview.fields?.length ?? 0) > 0
  const danger = preview.tone === 'danger'
  const valueOf = (f: EditableField) => draft[f.key] ?? f.value

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)]">
      <div className={cn('flex items-center gap-2 px-3.5 py-2.5 text-[13px] font-bold', TONE_HEAD[preview.tone])}>
        <Icon className="size-4 shrink-0" aria-hidden />
        <span className="min-w-0 flex-1 truncate">{preview.title}</span>
      </div>
      {editing ? (
        <div className="space-y-3 p-3.5">
          {preview.fields!.map((f) => (
            <div key={f.key} className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-brand-text-muted)]">{f.label}</span>
              <FieldControl field={f} value={valueOf(f)} onChange={(v) => setDraft((d) => ({ ...d, [f.key]: v }))} />
            </div>
          ))}
          {state.message ? <p role="alert" className="text-xs text-[var(--color-brand-red)]">{state.message}</p> : null}
          <div className="flex gap-2">
            <Button
              size="touch"
              className="flex-1"
              onClick={() => {
                onRevise(draft)
                setEditing(false)
                setDraft({})
              }}
            >
              {copy.update}
            </Button>
            <Button variant="outline" size="touch" onClick={() => { setEditing(false); setDraft({}) }}>
              {copy.cancel}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3 p-3">
          <FactsTable rows={preview.rows.map((r) => ({ label: r.label, value: r.value, sub: r.before ? <s className="opacity-70">{r.before}</s> : undefined }))} />
          {preview.effect ? <p className="px-1 text-xs text-[var(--color-brand-amber)]">{preview.effect}</p> : null}
          {state.message ? <p role="alert" className="px-1 text-xs text-[var(--color-brand-red)]">{state.message}</p> : null}
          <div className="flex gap-2">
            <Button variant={danger ? 'destructive-solid' : 'default'} size="touch" className="flex-1" onClick={onApply}>
              {copy.approveRisk(proposal.risk, preview.tone)}
            </Button>
            {editable ? (
              <Button variant="outline" size="touch" onClick={() => setEditing(true)}>
                {copy.edit}
              </Button>
            ) : (
              <Button variant="outline" size="touch" onClick={onDismiss}>
                {copy.dismiss}
              </Button>
            )}
          </div>
          {editable ? (
            <Button variant="ghost" size="touch" className="w-full text-[var(--color-brand-text-muted)]" onClick={onDismiss}>
              {copy.dismiss}
            </Button>
          ) : null}
        </div>
      )}
    </div>
  )
}
