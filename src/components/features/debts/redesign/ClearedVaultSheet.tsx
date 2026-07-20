'use client'

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Award, Check, ChevronDown, ChevronUp, X } from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import type { ClearedVM } from '@/hooks/useDebtTabData'
import type { DebtFamily } from '@/lib/debts/debtFamily'
import { fmtWhole } from './heroCardShared'

const FAMILY_TAG: Record<DebtFamily, string> = {
  borrow: 'Borrow',
  credit_card: 'Credit card',
  installment: 'Installment',
}

function Seal() {
  return (
    <span className="flex h-[54px] w-[54px] shrink-0 -rotate-12 items-center justify-center rounded-full border-2 border-dashed border-[#35D46F]/70 text-[#35D46F]">
      <Check className="h-6 w-6" strokeWidth={2.5} />
    </span>
  )
}

/** Celebratory cleared-debt archive (handoff §8). */
export function ClearedVaultSheet({ open, onClose, cleared, base }: { open: boolean; onClose: () => void; cleared: ClearedVM[]; base: string }) {
  const [selected, setSelected] = useState<string | null>(null)
  const sum = cleared.reduce((s, c) => s + c.original, 0)
  const detail = cleared.find((c) => c.id === selected) ?? null

  return (
    <ModalShell open={open} onBackdropClick={onClose} panelClassName="bg-[#0c1610]" scrollChild>
      <div className="flex items-start gap-3 px-5 pt-5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] bg-[rgba(29,185,84,.16)] text-[#35D46F]">
          <Award className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold text-white">Cleared vault</h2>
          <p className="mt-0.5 font-mono-numbers text-sm text-white/60">
            {cleared.length} cleared · {fmtWhole(sum)} {base} paid off
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/8 text-white/70 hover:bg-white/12"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="px-5 pb-6 pt-4">
        {cleared.length === 0 ? (
          <p className="py-10 text-center text-sm text-white/55">No cleared debts yet — finish one and it gets stamped here. 🎉</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {cleared.map((c) => {
              const on = selected === c.id
              return (
                <div key={c.id} className="flex flex-col rounded-[16px] border border-[#1DB954]/25 bg-[rgba(29,185,84,.05)] p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[10px] font-bold uppercase leading-tight tracking-[0.05em] text-[#35D46F]/80">
                      Cleared · {FAMILY_TAG[c.family]}
                    </p>
                    <Seal />
                  </div>
                  <p className="mt-1 truncate text-lg font-bold text-white">{c.name}</p>
                  <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.05em] text-white/45">Original</p>
                  <p className="font-mono-numbers text-xl font-bold text-white">
                    {fmtWhole(c.original)} <span className="text-sm text-white/55">{c.currency}</span>
                  </p>
                  <div className="mt-3 flex items-center justify-between border-t border-white/8 pt-2.5">
                    <span className="font-mono-numbers text-[12px] text-white/55">Cleared {c.clearedMonth}</span>
                    {c.history.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => setSelected(on ? null : c.id)}
                        className="inline-flex items-center gap-0.5 text-[12px] font-semibold text-[#35D46F]"
                      >
                        {on ? 'Hide' : 'History'}
                        {on ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </button>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {detail ? (
          <div className="mt-4 overflow-hidden rounded-[16px] border border-[#1DB954]/25 bg-[rgba(29,185,84,.05)]">
            <div className="flex items-center gap-3 p-3.5">
              <span className="flex h-11 w-11 shrink-0 -rotate-12 items-center justify-center rounded-full border-2 border-dashed border-[#35D46F]/70 text-[#35D46F]">
                <Check className="h-5 w-5" strokeWidth={2.5} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-bold text-white">{detail.name}</p>
                <p className="font-mono-numbers text-[13px] text-white/60">
                  Original {fmtWhole(detail.original)} {detail.currency} · {detail.clearedMonth}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label="Close history"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/8 text-white/70 hover:bg-white/12"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {detail.history.map((h, i) => (
              <div key={i} className="flex items-center gap-3 border-t border-white/8 px-4 py-3">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#35D46F]" />
                <span className="font-mono-numbers text-sm text-white/80">{format(parseISO(h.date), 'MMM d')}</span>
                <span className="ml-auto font-mono-numbers text-[13px] text-white/55">{h.method ?? '—'}</span>
                <span className="font-mono-numbers text-sm font-semibold text-white">−{fmtWhole(h.amount)}</span>
              </div>
            ))}
          </div>
        ) : null}

        <p className="mt-6 text-center text-[13px] leading-relaxed text-white/45">
          Every debt you finish is stamped here. Tap a seal to relive how you cleared it. 🎉
        </p>
      </div>
    </ModalShell>
  )
}
