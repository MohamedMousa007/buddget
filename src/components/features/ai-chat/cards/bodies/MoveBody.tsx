'use client'

import { ArrowDown } from 'lucide-react'
import { BrandMark } from '@/components/features/accounts/BrandMark'
import { bankLogoForName } from '@/lib/payment/bankLogos'
import type { PreviewModel, PreviewRef } from '@/lib/buddgy/tools/proposal'
import { money } from '@/lib/buddgy/tools/writeKit'
import { useBuddgyCardCopy } from '@/lib/i18n/buddgyCardCopy'
import { ChangeBody } from './ChangeBody'
import { Line } from './parts'

function End({ role, end }: { role: string; end: PreviewRef }) {
  return (
    <div className="flex min-h-[52px] items-center gap-3">
      <BrandMark name={end.name} color={end.color ?? 'var(--color-brand-primary)'} size={36} logo={bankLogoForName(end.name)} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-xs text-[var(--color-brand-text-muted)]">{role}</span>
        <span dir="auto" className="truncate font-semibold">{end.name}</span>
      </span>
      {end.now || end.after ? (
        <span className="font-mono-numbers text-end text-[0.78125rem] text-[var(--color-brand-text-secondary)]">
          {end.now ? <span className="block">{end.now}</span> : null}
          {end.after ? <span className="font-semibold text-[var(--color-brand-text-primary)]">{end.after}</span> : null}
        </span>
      ) : null}
    </div>
  )
}

/** Move money: where it leaves, the amount, where it lands, with each balance now and after. */
export function MoveBody({ preview }: { preview: PreviewModel }) {
  const copy = useBuddgyCardCopy().move
  const { from, to, amount, currency } = preview
  if (!from || !to || amount === undefined || !currency) return <ChangeBody preview={preview} />
  const balances = Boolean(from.after || to.after)
  return (
    <>
      <div className="flex flex-col gap-1">
        <End role={copy.from} end={from} />
        <div className="flex items-center gap-3 ps-2.5">
          <ArrowDown aria-hidden className="size-4 shrink-0 text-[var(--color-brand-primary-ink)]" />
          <span className="font-mono-numbers text-xl font-semibold text-[var(--color-brand-primary-ink)]">{money(amount, currency)}</span>
        </div>
        <End role={copy.to} end={to} />
        {balances ? <span className="text-xs text-[var(--color-brand-text-muted)]">{copy.balances}</span> : null}
      </div>
      {preview.effect ? <Line>{preview.effect}</Line> : null}
    </>
  )
}
