'use client'

import { useState } from 'react'
import { ChevronRight, Gem, Bitcoin, TrendingUp, Home } from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import { AssetFormSheet } from '@/components/features/savings-v3/AssetFormSheet'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
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
        <V3SheetHeader onClose={onClose}>
          <V3SheetHeader.Title>Add investment</V3SheetHeader.Title>
          <V3SheetHeader.Subtitle>What did you invest in?</V3SheetHeader.Subtitle>
        </V3SheetHeader>

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
