'use client'

import { useState } from 'react'
import { ChevronRight, Gem, Bitcoin, TrendingUp, Home, X } from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import { AssetFormSheet } from '@/components/features/savings-v3/AssetFormSheet'
import type { InvestmentAssetType } from '@/lib/store/types'

const TYPES: Array<{ key: InvestmentAssetType; icon: React.ReactNode; color: string; name: string; sub: string }> = [
  { key: 'gold', icon: <Gem size={23} />, color: '#F5C842', name: 'Gold', sub: 'Bars, coins, jewellery · priced by karat' },
  { key: 'crypto', icon: <Bitcoin size={23} />, color: '#B79CFF', name: 'Crypto', sub: 'Coins and tokens · live price' },
  { key: 'stock', icon: <TrendingUp size={23} />, color: '#35D46F', name: 'Stocks & funds', sub: 'EGX, US markets, ETFs' },
  { key: 'property', icon: <Home size={23} />, color: '#2CE0C6', name: 'Real estate', sub: 'Flat, land, shop · area estimate' },
]

export interface AddInvestmentSheetProps {
  open: boolean
  onClose: () => void
  /** Optional preset type (e.g. opened from a specific tab's Add button). */
  presetType?: InvestmentAssetType | null
}

export function AddInvestmentSheet({ open, onClose, presetType }: AddInvestmentSheetProps) {
  const [type, setType] = useState<InvestmentAssetType | null>(presetType ?? null)

  if (!open) return null
  if (type) return <AssetFormSheet open type={type} onClose={() => { setType(null); onClose() }} />

  return (
    <ModalShell open={open} onBackdropClick={onClose}>
      <div className="flex flex-col" style={{ maxHeight: '90vh' }}>
        <div className="flex items-start justify-between px-5 pt-4 pb-1">
          <div>
            <h2 className="text-[22px] font-bold text-[var(--color-brand-text-primary)]">Add investment</h2>
            <p className="mt-0.5 text-[13px] text-[var(--color-brand-text-secondary)]">What did you invest in?</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-secondary)]"><X size={18} /></button>
        </div>

        <div className="space-y-2.5 px-5 pb-5 pt-3">
          {TYPES.map((t) => (
            <button key={t.key} type="button" onClick={() => setType(t.key)}
              className="flex w-full items-center gap-3.5 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] p-3.5 text-left">
              <span className="flex h-11 w-11 items-center justify-center rounded-[13px]" style={{ background: `rgba(${hexToRgb(t.color)},.15)`, color: t.color }}>{t.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold text-[var(--color-brand-text-primary)]">{t.name}</p>
                <p className="text-xs text-[var(--color-brand-text-muted)]">{t.sub}</p>
              </div>
              <ChevronRight size={18} className="text-[var(--color-brand-text-muted)]" />
            </button>
          ))}
        </div>
      </div>
    </ModalShell>
  )
}

function hexToRgb(hex: string): string {
  const h = hex.replace('#', '')
  return `${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)}`
}
