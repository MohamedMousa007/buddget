'use client'

import { Input } from '@/components/ui/input'
import { OptionChip } from '@/components/ui/OptionChip'
import { useT } from '@/lib/i18n'
import { MAX_ACCOUNT_DIGITS } from '@/lib/accounts/identity/accountRef'
import { microClassName } from '@/lib/ui/microLabelStyle'

/** Trigger styling for the shared `CurrencyField` inside the account and card sheets, so both pick a currency the same way. */
export const ACCOUNT_CURRENCY_FIELD_CLASS =
  'h-12 w-full rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3 text-sm'

export type Identifier = 'last4' | 'label' | 'none'

interface AccountIdentifierFieldProps {
  mode: Identifier
  onModeChange: (m: Identifier) => void
  /** Whether this kind of account or card takes four digits at all. */
  allowsLast4: boolean
  last4: string
  onLast4Change: (v: string) => void
  label: string
  onLabelChange: (v: string) => void
}

/**
 * How an account is told apart on screen: the last four digits, a label of the user's own, or nothing. Shared by the
 * Add account and Add card sheets so both ask the same way. Choosing Label never discards the digits already stored:
 * SMS matching still needs them.
 * Built from OptionChip (size segment) and Input (brand), as the card sheet's identifier block was.
 */
export function AccountIdentifierField({ mode, onModeChange, allowsLast4, last4, onLast4Change, label, onLabelChange }: AccountIdentifierFieldProps) {
  const t = useT().paymentMethods
  const modes: Identifier[] = allowsLast4 ? ['last4', 'label', 'none'] : ['label', 'none']
  const names: Record<Identifier, string> = { last4: t.fourDigits, label: t.label, none: t.none }
  return (
    <div>
      <div className="mx-0.5 mb-2 flex items-center gap-2">
        <span className={microClassName}>{t.identifier}</span>
        <span className="text-[10px] font-medium text-[var(--color-brand-text-muted)]">{t.optional}</span>
      </div>
      <div className="flex gap-2">
        {modes.map((m) => (
          <OptionChip key={m} size="segment" selected={mode === m} onClick={() => onModeChange(m)}>{names[m]}</OptionChip>
        ))}
      </div>
      {mode === 'last4' ? (
        <>
          <Input
            value={last4}
            onChange={(e) => onLast4Change(e.target.value.replace(/\D/g, '').slice(0, MAX_ACCOUNT_DIGITS))}
            dir="ltr" inputMode="numeric" pattern="[0-9]*" maxLength={MAX_ACCOUNT_DIGITS} placeholder="e.g. 1234" aria-label={t.fourDigits}
            size="brand" className="mt-2.5 font-mono-numbers text-[15px] tracking-[0.1em] text-[var(--color-brand-text-primary)] text-start"
          />
          <div className="mt-2 px-0.5 text-[11.5px] text-[var(--color-brand-text-muted)]">{t.last4Help}</div>
        </>
      ) : null}
      {mode === 'label' ? (
        <>
          <Input
            value={label}
            onChange={(e) => onLabelChange(e.target.value)}
            maxLength={24} placeholder={t.tagPlaceholder} aria-label={t.label}
            size="brand" className="mt-2.5 text-[15px] text-[var(--color-brand-text-primary)] text-start"
          />
          {last4 ? <div className="mt-2 px-0.5 text-[11.5px] text-[var(--color-brand-text-muted)]">{t.labelKeepsDigits}</div> : null}
        </>
      ) : null}
    </div>
  )
}
