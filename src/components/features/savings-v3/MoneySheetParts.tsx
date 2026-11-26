'use client'

import { useState, type ReactNode } from 'react'
import { Plus, StickyNote, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/IconButton'
import { Input } from '@/components/ui/input'
import { AmountField } from '@/components/ui/AmountField'
import { CurrencyField } from '@/components/ui/CurrencyField'
import { FieldButton } from '@/components/ui/FieldButton'
import { AccountPicker } from '@/components/features/accounts/AccountPicker'
import { ProviderPickerSheet, type ProviderPickerItem } from '@/components/features/payments/ProviderPickerSheet'
import type { LegAccount } from '@/components/features/savings-v3/useLegAccount'
import { SavingsAccountIcon } from '@/components/features/savings/SavingsAccountIcon'
import { pocketColor, pocketDisplayName, pocketIdentity } from '@/lib/savings/pocketIdentity'
import { formatWhole as fmtNum } from '@/lib/utils/formatters'
import { micro } from '@/lib/ui/microLabelStyle'
import type { PocketVM } from '@/components/features/savings-v3/types'
import type { Currency, SavingsAccount } from '@/lib/store/types'
import { useLocale, useT } from '@/lib/i18n'
import { useLightTouchCopy } from '@/lib/i18n/lightTouchCopy'
import { PickerRow } from '@/components/ui/PickerRow'

/** A translucent wash of a (CSS-variable or hex) colour. */
export const tint = (color: string, pct: number) => `color-mix(in oklab, ${color} ${pct}%, transparent)`

/** A pocket's own icon on its own tint. */
export function PocketTile({ account, className, iconClassName = 'size-5' }: { account: SavingsAccount; className: string; iconClassName?: string }) {
  const color = pocketColor(account)
  return (
    <span className={`flex shrink-0 items-center justify-center ${className}`} style={{ background: tint(color, 14), color }}>
      <SavingsAccountIcon account={account} className={iconClassName} />
    </span>
  )
}

const balanceClass = 'shrink-0 font-mono-numbers text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]'

/** A goal listed in the pocket picker's Goals section. */
export interface PocketPickerGoal {
  id: string
  name: string
  /** The goal's own icon tile, sized by the picker. */
  glyph: ReactNode
  saved: number
  target: number | null
}

const isSafetyNet = (p: PocketVM) => p.coverAmount > 0 || !!p.account.isEmergencyCover

/**
 * The pocket choice of Add money (Into), Withdraw (From) and a goal's money: the chosen pocket or goal, opening a
 * searchable sheet grouped into Goals, Savings and Safety net, with balances and each goal's progress. `onAdd` adds
 * the sheet's "New pocket" ("New goal" with `only="goals"`) action; the caller opens the create flow above its own sheet.
 * `look="row"` renders it as a `PickerRow` inside a grouped list.
 */
export function PocketPickerField({ pockets, value, onChange, onGoalChange, label, onAdd, goals = [], only, look = 'field' }: {
  pockets: PocketVM[]
  /** The picked pocket's id, or a picked goal's when `onGoalChange` is not given. */
  value: string | null
  onChange: (id: string) => void
  /** A picked goal (one of `goals`). */
  onGoalChange?: (goalId: string) => void
  label: string
  onAdd?: () => void
  /** Listed first, under Goals. */
  goals?: PocketPickerGoal[]
  /** Lists the goals only (Which goal?). */
  only?: 'goals'
  look?: 'field' | 'row'
}) {
  const t = useT()
  const sf = t.savingsForms
  const m = t.wealthSheets.money
  const c = useLightTouchCopy().pocketPicker
  const { locale } = useLocale()
  const [open, setOpen] = useState(false)

  const goalItems: ProviderPickerItem[] = goals.map((g) => ({
    id: g.id,
    name: g.name,
    group: c.sections.goals,
    subtitle: g.target ? `${fmtNum(g.saved)} ${c.ofTarget(fmtNum(g.target))}` : fmtNum(g.saved),
    progress: g.target ? g.saved / g.target : undefined,
    glyph: <span className="flex size-full items-center justify-center overflow-hidden rounded-[11px]">{g.glyph}</span>,
  }))
  const pocketItems: ProviderPickerItem[] = only === 'goals' ? [] : [...pockets]
    .sort((a, b) => Number(isSafetyNet(a)) - Number(isSafetyNet(b)))
    .map((p) => ({
      id: p.account.id,
      name: pocketDisplayName(p.account, sf.systemNames),
      group: isSafetyNet(p) ? c.sections.safetyNet : c.sections.savings,
      subtitle: pocketIdentity(p.account, sf.identity, locale),
      glyph: <PocketTile account={p.account} className="size-full rounded-[11px]" />,
      trailing: <span className={balanceClass}>{fmtNum(p.account.currentBalance)}</span>,
    }))
  const items = [...goalItems, ...pocketItems]
  const goalIds = new Set(goals.map((g) => g.id))
  const selGoal = goals.find((g) => g.id === value)
  const sel = selGoal ? undefined : pockets.find((p) => p.account.id === value)?.account
  const selName = selGoal ? selGoal.name : sel ? pocketDisplayName(sel, sf.systemNames) : ''
  const pick = (id: string) => {
    setOpen(false)
    if (goalIds.has(id) && onGoalChange) onGoalChange(id)
    else onChange(id)
  }

  const sheet = (
    <ProviderPickerSheet
      open={open}
      selectedId={value}
      items={items}
      title={only === 'goals' ? c.goalTitle : c.pocketTitle}
      subtitle={only === 'goals' ? c.goalSub : c.pocketSub(items.length)}
      searchPlaceholder={m.searchPockets}
      emptyLabel={c.noMatch}
      customLabel={only === 'goals' ? c.newGoal : c.newPocket}
      onPick={pick}
      onCustom={onAdd ? () => { setOpen(false); onAdd() } : undefined}
      onClose={() => setOpen(false)}
    />
  )

  if (look === 'row') {
    return (
      <>
        <PickerRow
          label={label}
          onClick={() => setOpen(true)}
          aria-label={selName ? `${label}: ${selName}` : label}
          value={selGoal ? (
            <>
              <span className="flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-[7px] [&_svg]:size-3.5">{selGoal.glyph}</span>
              <span dir="auto" className="truncate">{selName}</span>
            </>
          ) : sel ? (
            <>
              <PocketTile account={sel} className="size-6 rounded-[7px]" iconClassName="size-3.5" />
              <span dir="auto" className="truncate">{selName}</span>
            </>
          ) : (
            <span className="text-[var(--color-brand-text-muted)]">{m.choosePocket}</span>
          )}
        />
        {sheet}
      </>
    )
  }

  return (
    <>
      <FieldButton
        size="lg"
        onClick={() => setOpen(true)}
        aria-label={selName ? `${label}: ${selName}` : label}
        placeholder={m.choosePocket}
        className="h-auto min-h-[64px] rounded-[14px] bg-[var(--color-brand-elevated)] py-2 ps-2 pe-3"
        value={sel ? (
          <span className="flex min-w-0 items-center gap-3">
            <PocketTile account={sel} className="size-10 rounded-xl" />
            <span className="min-w-0 flex-1">
              <span dir="auto" className="block truncate text-[0.9375rem] font-semibold">{selName}</span>
              <span className="block truncate text-xs text-[var(--color-brand-text-muted)]">{pocketIdentity(sel, sf.identity, locale)}</span>
            </span>
            <span className={balanceClass}>{fmtNum(sel.currentBalance)}</span>
          </span>
        ) : selGoal ? (
          <span className="flex min-w-0 items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl">{selGoal.glyph}</span>
            <span dir="auto" className="min-w-0 flex-1 truncate text-[0.9375rem] font-semibold">{selName}</span>
            <span className={balanceClass}>{fmtNum(selGoal.saved)}</span>
          </span>
        ) : undefined}
      />
      {sheet}
    </>
  )
}

/** The app's amount + currency row: glass AmountField beside a compact CurrencyField. */
export function AmountCurrencyRow({ amount, onAmount, currency, onCurrency, amountLabel, currencyLabel, includeGold }: {
  amount: string
  onAmount: (v: string) => void
  currency: Currency
  onCurrency: (c: Currency) => void
  amountLabel: string
  currencyLabel: string
  /** Offer gold (XAU) in the picker, for debt currency choices. */
  includeGold?: boolean
}) {
  return (
    <div className="grid gap-2.5" style={{ gridTemplateColumns: 'minmax(0,1fr) 108px' }}>
      <div>
        <p style={micro}>{amountLabel}</p>
        <div className="mt-2"><AmountField value={amount} onChange={onAmount} decimalsFor={currency} placeholder="0" /></div>
      </div>
      <div>
        <p style={micro}>{currencyLabel}</p>
        <CurrencyField
          compact
          value={currency}
          includeGold={includeGold}
          onChange={(c) => onCurrency(c as unknown as Currency)}
          className="mt-2 h-[52px] w-full rounded-[14px] border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3"
        />
      </div>
    </div>
  )
}

/** The one "From account" (deposit) / "To account" (withdraw) row; hidden when no tracked account can carry the leg. */
export function AccountLegRow({ leg, label }: { leg: LegAccount; label: string }) {
  if (leg.views.length === 0 || !leg.accountId) return null
  return (
    <div>
      <AccountPicker accounts={leg.views} value={leg.accountId} onChange={leg.setAccountId} label={label} />
    </div>
  )
}

/** A micro-labelled block: the small uppercase caption above a control group. */
export function LabeledBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p style={micro} className="mb-2">{label}</p>
      {children}
    </div>
  )
}

/** The scrolling body of a money sheet; `className` swaps the vertical rhythm. */
export function SheetBody({ children, className = 'space-y-4 pt-2' }: { children: ReactNode; className?: string }) {
  return <div className={`min-h-0 flex-1 overflow-y-auto px-5 pb-3 ${className}`}>{children}</div>
}

/** The pinned CTA row of a money sheet; `safeArea` clears the home indicator. */
export function SheetFooter({ children, safeArea }: { children: ReactNode; safeArea?: boolean }) {
  return <div className={safeArea ? 'px-5 pt-2 pb-[max(20px,env(safe-area-inset-bottom))]' : 'px-5 pb-5 pt-2'}>{children}</div>
}

/** Optional note: a "+ Note" link that expands into an input with a clear button. */
export function NoteField({ open, onOpen, onClose, value, onChange, labels }: {
  open: boolean
  onOpen: () => void
  onClose: () => void
  value: string
  onChange: (v: string) => void
  labels: { add: string; placeholder: string; clear: string }
}) {
  return open ? (
    <div className="relative">
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={labels.placeholder} size="brand" className="pe-12" />
      <IconButton onClick={() => { onChange(''); onClose() }} aria-label={labels.clear} size="sm" className="absolute end-2 top-1/2 -translate-y-1/2">
        <X size={16} />
      </IconButton>
    </div>
  ) : (
    <Button variant="link" size="sm" onClick={onOpen} className="font-semibold no-underline hover:underline">
      <Plus size={14} /> {labels.add}
    </Button>
  )
}

/** The slim note of a Light touch money sheet: one card-row with a note icon and a growing text line. */
export function NoteRow({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="flex min-h-12 items-start gap-3 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-4 py-3">
      <StickyNote className="mt-[3px] size-[18px] shrink-0 text-[var(--color-brand-text-muted)]" aria-hidden />
      <textarea
        rows={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        dir="auto"
        className="block min-h-6 w-full resize-none bg-transparent text-[0.9375rem] leading-6 text-[var(--color-brand-text-primary)] outline-none [field-sizing:content] placeholder:text-[var(--color-brand-text-muted)]"
      />
    </label>
  )
}
