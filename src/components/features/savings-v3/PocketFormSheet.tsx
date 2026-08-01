'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import { AmountField } from '@/components/ui/AmountField'
import { CurrencyField } from '@/components/ui/CurrencyField'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { SavingsAccountIcon } from '@/components/features/savings/SavingsAccountIcon'
import { POCKET_PROVIDERS, POCKET_COLORS, type PocketKindDef } from '@/lib/savings/pocketKinds'
import type { Currency, PaymentMethod } from '@/lib/store/types'

const micro: React.CSSProperties = { fontSize: 10, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--color-brand-text-muted)' }
const hexToRgb = (hex: string) => { const h = hex.replace('#', ''); return `${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)}` }

export interface PocketFormSheetProps {
  open: boolean
  /** Step back one level (back button / X / backdrop) — returns to the chooser, not the page. */
  onClose: () => void
  /** Full dismiss after a successful create (tears down the whole flow). Defaults to onClose. */
  onDone?: () => void
  def: PocketKindDef
  /** Prefill + link when created from an existing payment method. */
  linkedMethod?: PaymentMethod | null
}

export function PocketFormSheet({ open, onClose, onDone, def, linkedMethod }: PocketFormSheetProps) {
  const addSavingsAccount = useFinanceStore((s) => s.addSavingsAccount)
  const baseCurrency = useFinanceStore((s) => s.settings.baseCurrency)

  const has = (f: string) => def.fields.includes(f as never)

  const [provider, setProvider] = useState(linkedMethod?.name ?? '')
  const [last4, setLast4] = useState(linkedMethod?.last4 ?? '')
  const [maturity, setMaturity] = useState('')
  const [name, setName] = useState(linkedMethod?.name ?? def.label)
  const [balance, setBalance] = useState('')
  const [currency, setCurrency] = useState<Currency>(linkedMethod?.currency ?? baseCurrency)
  const [color, setColor] = useState(def.color)
  const [alsoPayment, setAlsoPayment] = useState(false)
  const [emergencyCover, setEmergencyCover] = useState(def.kind === 'bank' || def.kind === 'wallet')

  const create = () => {
    addSavingsAccount({
      name: name.trim() || def.label,
      category: 'savings',
      type: def.savingsType,
      currency,
      openingBalance: parseFloat(balance) || 0,
      color,
      isEmergencyCover: emergencyCover,
      icon: def.icon,
      ...(provider ? { institution: provider } : {}),
      ...(last4 ? { accountLast4: last4 } : {}),
      ...(maturity ? { maturityDate: maturity } : {}),
      ...(linkedMethod ? { linkedPaymentMethodId: linkedMethod.id } : {}),
    } as never)
    ;(onDone ?? onClose)()
  }

  if (!open) return null

  return (
    <ModalShell open={open} onBackdropClick={onClose}>
      <div className="flex flex-col" style={{ maxHeight: '92vh' }}>
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h2 className="text-[22px] font-bold text-[var(--color-brand-text-primary)]">New {def.label.toLowerCase()}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-secondary)]"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-3 space-y-4">
          {/* preview */}
          <div className="flex items-center gap-3 rounded-2xl p-3.5" style={{ border: `1px solid rgba(${hexToRgb(color)},.35)`, background: `rgba(${hexToRgb(color)},.06)` }}>
            <span className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: `rgba(${hexToRgb(color)},.16)`, color }}>
              <SavingsAccountIcon account={{ type: def.savingsType, icon: def.icon }} className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-[var(--color-brand-text-primary)]">{name || def.label}</p>
              <p className="font-mono-numbers text-xs text-[var(--color-brand-text-muted)]">{linkedMethod ? 'Linked' : 'Your new pocket'}</p>
            </div>
          </div>

          {has('provider') && (
            <div>
              <label style={micro}>Provider</label>
              <div className="mt-2 flex gap-2 overflow-x-auto no-scrollbar">
                {POCKET_PROVIDERS.map((p) => (
                  <button key={p} type="button" onClick={() => setProvider(p)} className="shrink-0 rounded-full px-4 py-2 text-sm font-medium"
                    style={{ border: provider === p ? '1px solid rgba(229,9,20,.45)' : '1px solid var(--color-brand-border)', background: provider === p ? 'rgba(229,9,20,.13)' : 'transparent', color: 'var(--color-brand-text-primary)' }}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {has('last4') && (
            <div>
              <label style={micro}>Last 4 digits</label>
              <Input value={last4} onChange={(e) => setLast4(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="2016" inputMode="numeric"
                className="mt-2 h-12 rounded-xl border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] font-mono-numbers" />
            </div>
          )}

          {has('maturity') && (
            <div>
              <label style={micro}>Matures on</label>
              <Input type="date" value={maturity} onChange={(e) => setMaturity(e.target.value)}
                className="mt-2 h-12 rounded-xl border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]" />
            </div>
          )}

          <div>
            <label style={micro}>Pocket name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={def.label}
              className="mt-2 h-12 rounded-xl border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]" />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label style={micro}>What&apos;s in it now</label>
              <AmountField value={balance} onChange={setBalance} currency={currency} placeholder="0.00"
                className="mt-2 h-12 rounded-xl border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] font-mono-numbers px-3" />
            </div>
            <div style={{ width: 104 }}>
              <label style={micro}>Currency</label>
              <CurrencyField value={currency} onChange={(c) => setCurrency(c as unknown as Currency)}
                className="mt-2 h-12 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3 font-mono-numbers text-sm font-semibold text-[var(--color-brand-text-primary)] w-full" />
            </div>
          </div>

          <div>
            <label style={micro}>Colour</label>
            <div className="mt-2 flex flex-wrap gap-3">
              {POCKET_COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)} aria-label={`Colour ${c}`}
                  className="h-9 w-9 rounded-full" style={{ background: c, outline: color === c ? '2px solid #fff' : 'none', outlineOffset: 2 }} />
              ))}
            </div>
          </div>

          {(def.kind === 'bank' || def.kind === 'wallet') && (
            <ToggleRow title="Also add as a payment method" sub="So you can spend from it too" on={alsoPayment} onToggle={setAlsoPayment} />
          )}
          <ToggleRow title="Counts as emergency cover" sub="Money you could reach fast" on={emergencyCover} onToggle={setEmergencyCover} />
        </div>

        <div className="px-5 pt-2 pb-[max(20px,env(safe-area-inset-bottom))]">
          <button type="button" onClick={create} className="w-full text-white" style={{ height: 52, borderRadius: 14, background: '#E50914', fontWeight: 600, fontSize: 15 }}>
            Create pocket
          </button>
        </div>
      </div>
    </ModalShell>
  )
}

function ToggleRow({ title, sub, on, onToggle }: { title: string; sub: string; on: boolean; onToggle: (v: boolean) => void }) {
  return (
    <div role="button" tabIndex={0} onClick={() => onToggle(!on)}
      className="flex w-full cursor-pointer items-center justify-between rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] p-3.5 text-left">
      <div>
        <p className="text-[15px] font-semibold text-[var(--color-brand-text-primary)]">{title}</p>
        <p className="text-xs text-[var(--color-brand-text-muted)]">{sub}</p>
      </div>
      {/* Canonical app switch; row handles the tap so the thumb is display-only. */}
      <Switch checked={on} onCheckedChange={onToggle} className="pointer-events-none shrink-0" />
    </div>
  )
}
