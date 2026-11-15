'use client'

import { useEffect, useState } from 'react'
import type { PurchasesPackage } from '@revenuecat/purchases-capacitor'
import { ModalShell } from '@/components/modals/ModalShell'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { SheetBody, SheetFooter } from '@/components/features/savings-v3/MoneySheetParts'
import { Button } from '@/components/ui/button'
import { SelectableCard } from '@/components/ui/SelectableCard'
import { billingOn, refreshUntilPaid, useBillingStore } from '@/lib/billing/billingStore'
import { buildPlanOptions, type PlanOption } from '@/lib/billing/planOptions'
import { loadPackages, purchasePackage } from '@/lib/billing/purchases'
import { useT } from '@/lib/i18n'

/** Plus, sold through the store. Renders nothing unless the server's billing switch is on and the sheet was opened. */
export function PaywallSheet() {
  const t = useT().billing
  const open = useBillingStore((s) => s.paywallOpen && billingOn(s.me))
  const closePaywall = useBillingStore((s) => s.closePaywall)
  const [packages, setPackages] = useState<PurchasesPackage[] | null>(null)
  const [picked, setPicked] = useState<'annual' | 'monthly'>('annual')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let live = true
    loadPackages().then((p) => live && setPackages(p)).catch(() => live && setPackages([]))
    return () => { live = false }
  }, [open])

  const close = () => {
    setNote(null)
    closePaywall()
  }
  if (!open) return null
  const options = buildPlanOptions(packages ?? [])
  const chosen = options.find((o) => o.kind === picked) ?? options[0]

  const buy = async (option: PlanOption) => {
    setBusy(true)
    setNote(null)
    const outcome = await purchasePackage(option.pkg)
    if (outcome === 'failed') setNote(t.purchaseFailed)
    if (outcome === 'purchased') {
      setNote(t.waitingForStore)
      await refreshUntilPaid()
      close()
    }
    setBusy(false)
  }

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
          <Button size="cta-block" loading={busy} disabled={!chosen} onClick={() => chosen && void buy(chosen)} className="font-semibold">{t.subscribe}</Button>
          <Button size="touch" variant="ghost" className="mt-1 w-full font-semibold text-[var(--color-brand-text-secondary)]" disabled={busy} onClick={close}>{t.notYet}</Button>
        </SheetFooter>
      </div>
    </ModalShell>
  )
}
