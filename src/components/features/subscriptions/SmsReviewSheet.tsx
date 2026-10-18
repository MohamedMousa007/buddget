'use client'

import { Link as LinkIcon, MessageSquare } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { Button } from '@/components/ui/button'
import { useSubscriptionDates } from '@/hooks/useSubscriptionDates'
import { useSubscriptionDetector, type SmsFind } from '@/hooks/useSubscriptionDetector'
import { findBrandByKey } from '@/lib/constants/subscriptionCatalog'
import { useLocale, useT } from '@/lib/i18n'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import type { Currency } from '@/lib/store/types'
import { convertCurrency } from '@/lib/utils/currency'
import { localTodayISO } from '@/lib/utils/localDate'
import { formatCurrency } from '@/lib/utils/formatters'
import { catalogRegionOf } from '@/lib/subscriptions/catalogDisplay'
import { planForAmount } from '@/lib/subscriptions/planChange'
import { chargesToLink, notASubscriptionKey } from '@/lib/subscriptions/smsFinds'
import { draftToSubscription } from '@/lib/subscriptions/subscriptionDraft'
import { money0, money2 } from '@/lib/subscriptions/subscriptionFormat'
import { startDateFromBillingDay } from '@/lib/subscriptions/subscriptionStartDate'
import { BrandTile } from './BrandTile'
import { ConfidenceMeter } from './ConfidenceMeter'
import { SheetFrame } from './SheetFrame'
import { currencyLabel } from './subscriptionLabels'

/** Resolve one find: link it to its existing subscription, or add it, then link its past charges. */
function useResolveFind() {
  const { profile, paymentMethods, expenses, addSubscription, updateSubscription, linkCharges } = useFinanceStore(
    useShallow((s) => ({
      profile: s.profile,
      paymentMethods: s.paymentMethods,
      expenses: s.expenses,
      addSubscription: s.addSubscription,
      updateSubscription: s.updateSubscription,
      linkCharges: s.linkSubscriptionCharges,
    })),
  )
  return (find: SmsFind) => {
    const brand = findBrandByKey(find.brandKey)
    const region = catalogRegionOf(profile)
    let subId = find.match?.id
    if (find.match) {
      updateSubscription(find.match.id, { tracking: 'sms' })
    } else if (brand) {
      const plan = planForAmount({ brandKey: brand.key, catalogRegion: region, currency: find.currency as Currency }, find.amount)
      subId = addSubscription(
        draftToSubscription(
          {
            name: brand.name,
            brandKey: brand.key,
            planId: plan?.id ?? null,
            planName: plan?.name ?? null,
            planRegion: plan ? region : null,
            amount: find.amount,
            currency: find.currency as Currency,
            cycle: 'monthly',
            firstCharge: startDateFromBillingDay(find.billingDay),
            paymentMethodId: paymentMethods.find((m) => m.isDefault)?.id ?? paymentMethods[0]?.id ?? null,
            tracking: 'sms',
            reminder: true,
            trial: false,
            sharedWith: [],
            myShare: null,
            category: brand.defaultCategory,
            notes: '',
          },
          null,
          localTodayISO(),
        ),
      )
    }
    if (subId) linkCharges(subId, chargesToLink(find, expenses, find.currency))
  }
}

function FindCard({ find, onAdd, onDismiss }: { find: SmsFind; onAdd: () => void; onDismiss: () => void }) {
  const t = useT()
  const { locale } = useLocale()
  const { shortDate: formatDateShort } = useSubscriptionDates()
  const { base, rates } = useFinanceStore(useShallow((s) => ({ base: s.settings.baseCurrency, rates: s.exchangeRates })))
  const sms = t.subscriptions.ui.sms
  const foreign = find.currency !== base

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] shadow-[var(--shadow-sm)]">
      <div className="flex flex-col gap-3 p-3.5">
        <div className="flex items-center gap-3">
          <BrandTile brandKey={find.brandKey} name={find.name} size={44} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-base font-semibold text-[var(--color-brand-text-primary)]">{find.name}</div>
            <div className="text-xs text-[var(--color-brand-text-secondary)]">
              {sms.monthlyDay(find.billingDay)}
            </div>
          </div>
          <div className="text-end">
            <div className="font-mono-numbers text-[17px] font-semibold text-[var(--color-brand-text-primary)]">
              {foreign ? formatCurrency(find.amount, find.currency) : money2(find.amount)}
            </div>
            <div className="font-mono-numbers text-[11px] text-[var(--color-brand-text-secondary)]">
              {foreign
                ? `≈ ${currencyLabel(base, locale)} ${money0(convertCurrency(find.amount, find.currency as Currency, base, rates))}`
                : currencyLabel(find.currency, locale)}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ConfidenceMeter level={find.confidence} />
            <span className="text-xs font-semibold text-[var(--color-brand-text-primary)]">{sms.confidence[find.confidence]}</span>
          </div>
          <div className="flex gap-1">
            {find.dates.map((d) => (
              <span key={d} className="font-mono-numbers rounded-full bg-[var(--color-brand-elevated)] px-2 py-0.5 text-[11px] text-[var(--color-brand-text-secondary)]">
                {formatDateShort(d)}
              </span>
            ))}
          </div>
        </div>
        {find.excerpt ? (
          <div className="flex items-start gap-2 rounded-[10px] bg-[var(--color-brand-elevated)] px-2.5 py-2 text-xs leading-snug text-[var(--color-brand-text-secondary)]">
            <MessageSquare className="mt-px size-[13px] shrink-0" strokeWidth={1.75} aria-hidden />
            <span className="font-mono-numbers">{find.excerpt}</span>
          </div>
        ) : null}
        {find.match ? (
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-brand-primary-ink)]">
            <LinkIcon className="size-3.5" strokeWidth={1.75} aria-hidden />
            {sms.matches(find.match.name)}
          </div>
        ) : null}
      </div>
      <div className="flex gap-2 px-3.5 pb-3.5">
        <Button variant="outline" size="cta" className="min-w-0 flex-1" onClick={onDismiss}>
          {sms.notASub}
        </Button>
        <Button size="cta" className="min-w-0 flex-1" onClick={onAdd}>
          {find.match ? sms.linkTo(find.match.name) : sms.add}
        </Button>
      </div>
    </div>
  )
}

/** Review what the SMS scan found. Nothing is added until each find is confirmed. */
export function SmsReviewSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT()
  const sms = t.subscriptions.ui.sms
  const { finds, scanned } = useSubscriptionDetector()
  const dismiss = useSettingsStore((s) => s.dismissBanner)
  const resolve = useResolveFind()
  if (!open) return null

  const addAll = () => {
    finds.forEach(resolve)
    onClose()
  }

  return (
    <SheetFrame
      open
      onClose={onClose}
      title={sms.found(finds.length)}
      footer={
        finds.length > 0 ? (
          <Button size="cta-block" onClick={addAll}>
            {sms.addN(finds.length)}
          </Button>
        ) : undefined
      }
    >
      <div className="flex items-center gap-3 rounded-2xl bg-[var(--color-brand-primary-soft)] px-3.5 py-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-brand-card)] text-[var(--color-brand-primary-ink)]">
          <MessageSquare className="size-[18px]" strokeWidth={1.75} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-[var(--color-brand-text-primary)]">{sms.scanned(scanned)}</div>
          <div className="text-xs text-[var(--color-brand-text-secondary)]">{sms.nothingAdded}</div>
        </div>
      </div>
      {finds.length === 0 ? <p className="py-6 text-center text-sm text-[var(--color-brand-text-secondary)]">{sms.none}</p> : null}
      {finds.map((f) => (
        <FindCard
          key={f.brandKey}
          find={f}
          onAdd={() => resolve(f)}
          onDismiss={() => dismiss(notASubscriptionKey(f.brandKey))}
        />
      ))}
    </SheetFrame>
  )
}
