'use client'

import { ChevronRight, Shield } from 'lucide-react'

const fmtNum = (n: number) => Math.round(n).toLocaleString('en-US')

export interface EmergencyFundCardProps {
  monthsCovered: number
  targetMonths: number
  coverAmount: number
  gap: number
  atOrAboveTarget: boolean
  onOpen: () => void
}

export function EmergencyFundCard({ monthsCovered, targetMonths, coverAmount, gap, atOrAboveTarget, onOpen }: EmergencyFundCardProps) {
  const pct = targetMonths > 0 ? Math.min(100, (monthsCovered / targetMonths) * 100) : 0
  const moColor = atOrAboveTarget ? '#35D46F' : '#7EAEF9'
  return (
    <div className="mx-4 mt-0" style={{ borderRadius: 18 }}>
      <button type="button" onClick={onOpen} className="w-full rounded-[18px] border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-3.5 text-left">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'rgba(126,174,249,.14)', color: '#7EAEF9' }}><Shield size={18} /></span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[var(--color-brand-text-primary)]">Emergency fund</p>
            <p className="font-mono-numbers text-xs text-[var(--color-brand-text-muted)]">of {targetMonths} months · {fmtNum(coverAmount)} EGP</p>
          </div>
          <span className="font-mono-numbers text-[17px] font-semibold" style={{ color: moColor }}>{monthsCovered.toFixed(1)} mo</span>
          <ChevronRight size={18} className="text-[var(--color-brand-text-muted)]" />
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,.08)' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: moColor }} />
        </div>
      </button>
      {!atOrAboveTarget && gap > 0 && (
        <div className="mt-2 rounded-xl px-3 py-2 text-xs" style={{ background: 'rgba(255,177,61,.1)', color: '#FFB13D' }}>
          You&apos;ve dipped {fmtNum(gap)} EGP below your cover. Nothing is blocked — worth topping back up when you can.
        </div>
      )}
    </div>
  )
}
