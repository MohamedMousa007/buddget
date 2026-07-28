'use client'

import { useMemo, useState } from 'react'
import { Calendar, Plus, Wallet, PackageOpen, X } from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import { AmountField } from '@/components/ui/AmountField'
import { CurrencyField } from '@/components/ui/CurrencyField'
import { Input } from '@/components/ui/input'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { PocketCard } from '@/components/features/savings-v3/PocketCard'
import type { PocketVM } from '@/components/features/savings-v3/PocketsCarousel'
import { pocketColor, pocketIdentity } from '@/lib/savings/pocketIdentity'
import { SavingsAccountIcon } from '@/components/features/savings/SavingsAccountIcon'
import type { Currency } from '@/lib/store/types'

const micro: React.CSSProperties = { fontSize: 10, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--color-brand-text-muted)' }

function fmtNum(n: number): string {
  return Math.round(n).toLocaleString('en-US')
}

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
        {/* header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h2 className="text-[22px] font-bold text-[var(--color-brand-text-primary)]">Add savings</h2>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-brand-border)] px-3 py-1.5 text-sm text-[var(--color-brand-text-secondary)]">
              <Calendar size={14} /> Today
            </span>
            <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-secondary)]">
              <X size={18} />
            </button>
          </div>
        </div>

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
              <div className="mt-2 flex items-center gap-3 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] p-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: `rgba(${hexToRgb(pocketColor(selected.account))},.14)`, color: pocketColor(selected.account) }}>
                  <SavingsAccountIcon account={selected.account} className="h-4.5 w-4.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--color-brand-text-primary)]">{selected.account.name}</p>
                  <p className="truncate font-mono-numbers text-xs text-[var(--color-brand-text-muted)]">
                    {pocketIdentity(selected.account)} · {fmtNum(selected.account.currentBalance)} {selected.account.currency}
                  </p>
                </div>
                <button type="button" onClick={() => setLocked(false)} className="rounded-full border border-[var(--color-brand-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-brand-text-secondary)]">
                  Change
                </button>
              </div>
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
                icon={<Wallet size={18} />} iconColor="#F5C842" title="This month" sub={`Leaves ${fmtNum(remaining)} EGP`}
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
                className="h-[46px] rounded-xl border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] pr-10" />
              <button type="button" onClick={() => { setNote(''); setNoteOpen(false) }} aria-label="Clear note"
                className="absolute end-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center text-[var(--color-brand-text-muted)]">
                <X size={16} />
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setNoteOpen(true)} className="inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: '#E50914' }}>
              <Plus size={14} /> Add note
            </button>
          )}
        </div>

        {/* footer CTA */}
        <div className="px-5 pt-2 pb-[max(20px,env(safe-area-inset-bottom))]">
          <button
            type="button" onClick={submit} disabled={!canSubmit}
            className="w-full text-white"
            style={{
              height: 52, borderRadius: 14, fontWeight: 600, fontSize: 15,
              background: canSubmit ? '#E50914' : 'var(--color-brand-elevated)',
              color: canSubmit ? '#fff' : 'var(--color-brand-text-muted)',
              cursor: canSubmit ? 'pointer' : 'default',
            }}
          >
            {ctaLabel}
          </button>
        </div>
      </div>
    </ModalShell>
  )
}

function SourceCard({ icon, iconColor, title, sub, on, onClick }: {
  icon: React.ReactNode; iconColor: string; title: string; sub: string; on: boolean; onClick: () => void
}) {
  return (
    <button type="button" onClick={onClick} className="relative rounded-2xl p-3 text-left"
      style={{
        border: on ? '1px solid rgba(229,9,20,.5)' : '1px solid var(--color-brand-border)',
        background: on ? 'rgba(229,9,20,.06)' : 'var(--color-brand-elevated)',
      }}>
      <div className="flex items-start justify-between">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: `rgba(${hexToRgb(iconColor)},.14)`, color: iconColor }}>
          {icon}
        </span>
        <span className="flex h-5 w-5 items-center justify-center rounded-full" style={{ border: on ? undefined : '1.5px solid var(--color-brand-border)', background: on ? '#E50914' : 'transparent' }}>
          {on && <span className="h-2.5 w-2.5 rounded-full bg-white" />}
        </span>
      </div>
      <p className="mt-2 text-[13px] font-semibold text-[var(--color-brand-text-primary)]">{title}</p>
      <p className="font-mono-numbers text-[10.5px] text-[var(--color-brand-text-muted)]">{sub}</p>
    </button>
  )
}

function hexToRgb(hex: string): string {
  const h = hex.replace('#', '')
  return `${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)}`
}
