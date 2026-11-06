'use client'

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Award, Check, ChevronDown, ChevronUp, X } from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import type { ClearedVM } from '@/hooks/useDebtTabData'
import type { DebtFamily } from '@/lib/debts/debtFamily'
import { fmtWhole, soft } from './heroCardShared'
import { ModalHeading } from '@/components/modals/ModalTitle'
import { IconButton } from '@/components/ui/IconButton'
import { Button } from '@/components/ui/button'
import { useT } from '@/lib/i18n'

const GREEN = 'var(--color-brand-green)'
const VAULT_CARD = 'rounded-[16px] border border-[var(--color-brand-green)]/25 bg-[var(--color-brand-green-soft)]'

function Seal({ size }: { size: 'sm' | 'lg' }) {
  return (
    <span
      className={`flex shrink-0 -rotate-12 items-center justify-center rounded-full border-2 border-dashed border-[var(--color-brand-green)]/70 text-[var(--color-brand-green)] ${size === 'lg' ? 'h-[54px] w-[54px]' : 'h-11 w-11'}`}
    >
      <Check className={size === 'lg' ? 'h-6 w-6' : 'h-5 w-5'} strokeWidth={2.5} />
    </span>
  )
}

/** Celebratory cleared-debt archive (handoff §8). */
export function ClearedVaultSheet({ open, onClose, cleared, base }: { open: boolean; onClose: () => void; cleared: ClearedVM[]; base: string }) {
  const t = useT().debts
  const [selected, setSelected] = useState<string | null>(null)
  const sum = cleared.reduce((s, c) => s + c.original, 0)
  const detail = cleared.find((c) => c.id === selected) ?? null
  const familyTag: Record<DebtFamily, string> = {
    borrow: t.tagBorrow,
    credit_card: t.tagCard,
    installment: t.tagInstallment,
  }

  return (
    <ModalShell open={open} onBackdropClick={onClose} panelClassName="bg-[var(--color-brand-card)]" scrollChild>
      <div className="flex items-start gap-3 px-5 pt-5">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] text-[var(--color-brand-green)]"
          style={{ background: soft(GREEN, 16) }}
        >
          <Award className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <ModalHeading className="text-2xl font-bold text-[var(--color-brand-text-primary)]">{t.vaultTitle}</ModalHeading>
          <p className="mt-0.5 font-mono-numbers text-sm text-[var(--color-brand-text-muted)]">
            {t.vaultSummary(cleared.length, fmtWhole(sum), base)}
          </p>
        </div>
        <IconButton onClick={onClose} aria-label={t.closeLabel} variant="tinted" size="sm" shape="round">
          <X className="h-4 w-4" />
        </IconButton>
      </div>

      <div className="px-5 pb-6 pt-4">
        {cleared.length === 0 ? (
          <p className="py-10 text-center text-sm text-[var(--color-brand-text-muted)]">{t.vaultEmpty}</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {cleared.map((c) => {
              const on = selected === c.id
              return (
                <div key={c.id} className={`flex flex-col p-3.5 ${VAULT_CARD}`}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[0.625rem] font-bold uppercase leading-tight tracking-[0.05em] text-[var(--color-brand-green)]">
                      {t.clearedTag(familyTag[c.family])}
                    </p>
                    <Seal size="lg" />
                  </div>
                  <p className="mt-1 truncate text-lg font-bold text-[var(--color-brand-text-primary)]">{c.name}</p>
                  <p className="mt-2 text-[0.625rem] font-bold uppercase tracking-[0.05em] text-[var(--color-brand-text-muted)]">{t.originalLabel}</p>
                  <p className="font-mono-numbers text-xl font-bold text-[var(--color-brand-text-primary)]">
                    {fmtWhole(c.original)} <span className="text-sm text-[var(--color-brand-text-muted)]">{c.currency}</span>
                  </p>
                  <div className="mt-3 flex items-center justify-between border-t border-[var(--color-brand-border)] pt-2.5">
                    <span className="font-mono-numbers text-[0.75rem] text-[var(--color-brand-text-muted)]">{t.clearedMonth(c.clearedMonth)}</span>
                    {c.history.length > 0 ? (
                      <Button
                        variant="ghost"
                        size="touch"
                        onClick={() => setSelected(on ? null : c.id)}
                        className="text-[0.75rem] font-semibold text-[var(--color-brand-green)]"
                      >
                        {on ? t.hide : t.historyLabel}
                        {on ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </Button>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {detail ? (
          <div className={`mt-4 overflow-hidden ${VAULT_CARD}`}>
            <div className="flex items-center gap-3 p-3.5">
              <Seal size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-bold text-[var(--color-brand-text-primary)]">{detail.name}</p>
                <p className="font-mono-numbers text-[0.8125rem] text-[var(--color-brand-text-muted)]">
                  {t.vaultOriginalLine(fmtWhole(detail.original), detail.currency, detail.clearedMonth)}
                </p>
              </div>
              <IconButton onClick={() => setSelected(null)} aria-label={t.closeHistory} variant="tinted" size="sm" shape="round">
                <X className="h-4 w-4" />
              </IconButton>
            </div>
            {detail.history.map((h, i) => (
              <div key={i} className="flex items-center gap-3 border-t border-[var(--color-brand-border)] px-4 py-3">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--color-brand-green)]" />
                <span className="font-mono-numbers text-sm text-[var(--color-brand-text-secondary)]">{format(parseISO(h.date), 'MMM d')}</span>
                <span className="ms-auto font-mono-numbers text-[0.8125rem] text-[var(--color-brand-text-muted)]">{h.method ?? '—'}</span>
                <span className="font-mono-numbers text-sm font-semibold text-[var(--color-brand-text-primary)]">−{fmtWhole(h.amount)}</span>
              </div>
            ))}
          </div>
        ) : null}

        <p className="mt-6 text-center text-[0.8125rem] leading-relaxed text-[var(--color-brand-text-muted)]">{t.vaultFooter}</p>
      </div>
    </ModalShell>
  )
}
