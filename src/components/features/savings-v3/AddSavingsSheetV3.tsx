'use client'

import { useMemo, useState } from 'react'
import { Calendar, Plus, Wallet, PackageOpen, X } from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import { AmountField } from '@/components/ui/AmountField'
import { CurrencyField } from '@/components/ui/CurrencyField'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { PocketCard } from '@/components/features/savings-v3/PocketCard'
import type { PocketVM } from '@/components/features/savings-v3/PocketsCarousel'
import { pocketColor, pocketIdentity } from '@/lib/savings/pocketIdentity'
import { SavingsAccountIcon } from '@/components/features/savings/SavingsAccountIcon'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { rgba } from '@/lib/utils/color'
import { formatWhole as fmtNum } from '@/lib/utils/formatters'
import { micro } from '@/lib/ui/microLabelStyle'
import type { Currency } from '@/lib/store/types'
import { IconButton } from '@/components/ui/IconButton'
import { SelectableCard } from '@/components/ui/SelectableCard'

export interface AddSavingsSheetV3Props {
  open: boolean
  onClose: () => void
  pockets: PocketVM[]
  /** When set, the sheet opens locked to this pocket (opened from a pocket's Add). */
  defaultAccountId?: string | null
  leftToSpend: number
}

export function AddSavingsSheetV3({ open, onClose, pockets, defaultAccountId, leftToSpend }: AddSavingsSheetV3Props) {
  const deposit = useFinanceStore((s) => s.depositToSavings)
  const baseCurrency = useFinanceStore((s) => s.settings.baseCurrency)

  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState<Currency>(baseCurrency)
  const [selectedId, setSelectedId] = useState<string | null>(defaultAccountId ?? null)
  const [locked, setLocked] = useState(!!defaultAccountId)
  const [source, setSource] = useState<'budget' | 'had'>('budget')
  const [noteOpen, setNoteOpen] = useState(false)
  const [note, setNote] = useState('')

  const amountNum = parseFloat(amount) || 0
  const selected = pockets.find((p) => p.account.id === selectedId)
  const remaining = Math.max(0, leftToSpend - amountNum)

  const canSubmit = amountNum > 0 && !!selected

  const submit = () => {
    if (!selected || amountNum <= 0) return
    deposit(selected.account.id, amountNum, currency, note.trim() || undefined, {
      mode: source === 'budget' ? 'allocate' : 'declare',
    })
    onClose()
  }

  const ctaLabel = useMemo(() => {
    if (!selected) return 'Choose a pocket'
    return `Add ${amountNum > 0 ? fmtNum(amountNum) : ''} to ${selected.account.name}`.replace('  ', ' ')
  }, [selected, amountNum])

  if (!open) return null

  return (
    <ModalShell open={open} onBackdropClick={onClose}>
      <div className="flex flex-col" style={{ maxHeight: '90vh' }}>
        <V3SheetHeader onClose={onClose}>
          <V3SheetHeader.Title>Add savings</V3SheetHeader.Title>
          <V3SheetHeader.Extra>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-brand-border)] px-3 py-1.5 text-sm text-[var(--color-brand-text-secondary)]">
              <Calendar size={14} /> Today
            </span>
          </V3SheetHeader.Extra>
        </V3SheetHeader>

        {/* body */}
        <div className="flex-1 overflow-y-auto px-5 pb-3 space-y-4">
          <div className="flex gap-3">
            <div className="flex-1">
              <label style={micro}>Amount</label>
              <AmountField value={amount} onChange={setAmount} currency={currency} placeholder="0.00"
                className="mt-2 h-14 rounded-2xl border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] text-2xl font-mono-numbers font-bold text-[var(--color-brand-text-primary)] px-4" />
            </div>
            <div style={{ width: 104 }}>
              <label style={micro}>Currency</label>
              <CurrencyField value={currency} onChange={(c) => setCurrency(c as unknown as Currency)}
                className="mt-2 h-14 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-4 font-mono-numbers text-[15px] font-semibold text-[var(--color-brand-text-primary)] w-full" />
            </div>
          </div>

          {/* Destination */}
          <div>
            <label style={micro}>Pocket</label>
            {locked && selected ? (
              <Card variant="elevated" padding="sm" className="mt-2 flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: rgba(pocketColor(selected.account), .14), color: pocketColor(selected.account) }}>
                  <SavingsAccountIcon account={selected.account} className="h-4.5 w-4.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--color-brand-text-primary)]">{selected.account.name}</p>
                  <p className="truncate font-mono-numbers text-xs text-[var(--color-brand-text-muted)]">
                    {pocketIdentity(selected.account)} · {fmtNum(selected.account.currentBalance)} {selected.account.currency}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setLocked(false)} className="rounded-full">
                  Change
                </Button>
              </Card>
            ) : (
              <div className="mt-2 flex gap-3 overflow-x-auto no-scrollbar" style={{ scrollSnapType: 'x mandatory', padding: '2px 0 4px' }}>
                {pockets.map((p) => (
                  <PocketCard
                    key={p.account.id} account={p.account} coverAmount={p.coverAmount}
                    goalsAmount={p.goalsAmount} goalLabel={p.goalLabel} isAuto={p.isAuto}
                    picker selected={selectedId === p.account.id}
                    onSelect={() => setSelectedId(p.account.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Source */}
          <div>
            <label style={micro}>Source</label>
            <div className="mt-2 grid grid-cols-2 gap-2.5">
              <SourceCard
                icon={<Wallet size={18} />} iconColor="#EDC463" title="This month" sub={`Leaves ${fmtNum(remaining)} EGP`}
                on={source === 'budget'} onClick={() => setSource('budget')}
              />
              <SourceCard
                icon={<PackageOpen size={18} />} iconColor="#35D46F" title="Already had it" sub="Budget untouched"
                on={source === 'had'} onClick={() => setSource('had')}
              />
            </div>
          </div>

          {/* Note */}
          {noteOpen ? (
            <div className="relative">
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What was it for?"
                size="brand" className="pr-10" />
              <IconButton onClick={() => { setNote(''); setNoteOpen(false) }} aria-label="Clear note" size="sm"
                className="absolute end-2 top-1/2 -translate-y-1/2">
                <X size={16} />
              </IconButton>
            </div>
          ) : (
            <Button variant="link" size="sm" onClick={() => setNoteOpen(true)} className="font-semibold no-underline hover:underline">
              <Plus size={14} /> Add note
            </Button>
          )}
        </div>

        {/* footer CTA */}
        <div className="px-5 pt-2 pb-[max(20px,env(safe-area-inset-bottom))]">
          <Button size="cta-block" onClick={submit} disabled={!canSubmit} className="font-semibold">
            {ctaLabel}
          </Button>
        </div>
      </div>
    </ModalShell>
  )
}

function SourceCard({ icon, iconColor, title, sub, on, onClick }: {
  icon: React.ReactNode; iconColor: string; title: string; sub: string; on: boolean; onClick: () => void
}) {
  return (
    <SelectableCard layout="stack" selected={on} onClick={onClick}>
      <div className="flex items-start justify-between">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: rgba(iconColor, .14), color: iconColor }}>
          {icon}
        </span>
        <span className="flex h-5 w-5 items-center justify-center rounded-full" style={{ border: on ? undefined : '1.5px solid var(--color-brand-border)', background: on ? 'var(--color-brand-primary)' : 'transparent' }}>
          {on && <span className="h-2.5 w-2.5 rounded-full bg-white" />}
        </span>
      </div>
      <p className="mt-2 text-[13px] font-semibold text-[var(--color-brand-text-primary)]">{title}</p>
      <p className="font-mono-numbers text-[10.5px] text-[var(--color-brand-text-muted)]">{sub}</p>
    </SelectableCard>
  )
}

