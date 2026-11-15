'use client'

import { ModalShell } from '@/components/modals/ModalShell'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { SheetBody, SheetFooter } from '@/components/features/savings-v3/MoneySheetParts'
import { Button } from '@/components/ui/button'
import { SelectableCard } from '@/components/ui/SelectableCard'
import { billingOn, useBillingStore } from '@/lib/billing/billingStore'
import { type PlanOption } from '@/lib/billing/planOptions'
import { usePlanPurchase } from '@/lib/billing/usePlanPurchase'
import { useT } from '@/lib/i18n'

/** Pro, sold through the store. Renders nothing unless the server's billing switch is on and the sheet was opened. */
export function PaywallSheet() {
  const t = useT().billing
  const open = useBillingStore((s) => s.paywallOpen && billingOn(s.me))
  const closePaywall = useBillingStore((s) => s.closePaywall)
  const { packages, options, chosen, setPicked, busy, note, setNote, buy, restore } = usePlanPurchase(open, t)

  const close = () => {
    setNote(null)
    closePaywall()
  }
  if (!open) return null
  const buyAndClose = async (option: PlanOption) => { if (await buy(option)) close() }
  const restoreAndClose = async () => { if (await restore()) close() }

  return (
    <ModalShell open onBackdropClick={busy ? () => {} : close} scrollChild>
      <div className="flex min-h-0 flex-1 flex-col">
        <V3SheetHeader onClose={busy ? () => {} : close}>
          <V3SheetHeader.Title>{t.paywallTitle}</V3SheetHeader.Title>
          <V3SheetHeader.Subtitle>{t.paywallSubtitle}</V3SheetHeader.Subtitle>
        </V3SheetHeader>
        <SheetBody className="space-y-4 pt-1">
          <ul className="space-y-1.5 text-sm text-[var(--color-brand-text-secondary)]">
            {t.perks.map((perk) => <li key={perk}>{perk}</li>)}
          </ul>
          {packages === null ? (
            <p role="status" className="text-xs text-[var(--color-brand-text-muted)]">{t.loading}</p>
          ) : options.length === 0 ? (
            <p role="status" className="text-xs text-[var(--color-brand-amber)]">{t.unavailable}</p>
          ) : (
            <div role="radiogroup" aria-label={t.paywallTitle} className="flex flex-col gap-2">
              {options.map((o) => (
                <SelectableCard key={o.kind} selected={chosen?.kind === o.kind} onClick={() => setPicked(o.kind)} disabled={busy}>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">{o.kind === 'annual' ? t.annual : t.monthly}</span>
                    {o.perMonth ? <span className="block text-xs text-[var(--color-brand-text-muted)]">{t.monthlyEquivalent(o.perMonth)}</span> : null}
                  </span>
                  <span className="text-end">
                    <span className="font-mono-numbers block text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">{o.price}</span>
                    <span className="block text-xs text-[var(--color-brand-text-muted)]">{o.kind === 'annual' ? t.perYear : t.perMonth}</span>
                  </span>
                </SelectableCard>
              ))}
            </div>
          )}
          {note ? <p role="status" className="text-xs leading-snug text-[var(--color-brand-text-secondary)]">{note}</p> : null}
        </SheetBody>
        <SheetFooter safeArea>
          <Button size="cta-block" loading={busy} disabled={!chosen} onClick={() => chosen && void buyAndClose(chosen)} className="font-semibold">{t.subscribe}</Button>
          <Button size="touch" variant="ghost" className="mt-1 w-full font-semibold text-[var(--color-brand-text-secondary)]" disabled={busy} onClick={close}>{t.notYet}</Button>
          <Button size="touch" variant="ghost" className="w-full text-[var(--color-brand-text-muted)]" disabled={busy} onClick={() => void restoreAndClose()}>{t.restore}</Button>
        </SheetFooter>
      </div>
    </ModalShell>
  )
}
