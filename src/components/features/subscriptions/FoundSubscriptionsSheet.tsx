'use client'

import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Badge } from '@/components/ui/badge'
import { ResolveRow, ResolveSheet } from '@/components/modals/ResolveSheet'
import { useSubscriptionDates } from '@/hooks/useSubscriptionDates'
import { useSubscriptionDetector, type SmsFind } from '@/hooks/useSubscriptionDetector'
import { findBrandByKey } from '@/lib/constants/subscriptionCatalog'
import { useLocale, useT } from '@/lib/i18n'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { Currency } from '@/lib/store/types'
import { convertCurrency } from '@/lib/utils/currency'
import { localTodayISO } from '@/lib/utils/localDate'
import { formatCurrency, formatFixed2, formatWhole } from '@/lib/utils/formatters'
import { catalogRegionOf } from '@/lib/subscriptions/catalogDisplay'
import { planForAmount } from '@/lib/subscriptions/planChange'
import { chargesToLink, notASubscriptionKey } from '@/lib/subscriptions/smsFinds'
import { draftToSubscription } from '@/lib/subscriptions/subscriptionDraft'
import { startDateFromBillingDay } from '@/lib/subscriptions/subscriptionStartDate'
import { BrandTile } from './BrandTile'
import { currencyLabel } from './subscriptionLabels'
import { settlePrompt } from '@/lib/prompts/settle'

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
      subId = addSubscription({
        ...draftToSubscription(
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
        // The first-charge date is clamped into a month; the detected day is the real billing day.
        billingDay: find.billingDay,
      })
    }
    if (subId) linkCharges(subId, chargesToLink(find, expenses, find.currency))
  }
}

/** The evidence behind a find, one tap away: the charge dates and the message excerpt. */
function FindDetail({ find }: { find: SmsFind }) {
  const { shortDate } = useSubscriptionDates()
  return (
    <div className="flex flex-col gap-2 px-1">
      <div className="flex flex-wrap gap-1">
        {find.dates.map((d, i) => (
          <Badge key={`${i}-${d}`} tone="soft" bordered={false} className="font-mono-numbers text-[0.6875rem] font-normal">
            {shortDate(d)}
          </Badge>
        ))}
      </div>
      {find.excerpt ? <p dir="auto" className="font-mono-numbers text-[0.6875rem] leading-[1.45] text-[var(--color-brand-text-secondary)]">{find.excerpt}</p> : null}
    </div>
  )
}

/** Review what the SMS scan found. Nothing is added until the user confirms; every find starts selected (adding is reversible). */
export function FoundSubscriptionsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT()
  const { locale } = useLocale()
  const sms = t.subscriptions.ui.sms
  const { finds, scanned } = useSubscriptionDetector()
  const { base, rates } = useFinanceStore(useShallow((s) => ({ base: s.settings.baseCurrency, rates: s.exchangeRates })))
  const resolve = useResolveFind()
  const [off, setOff] = useState<Set<string>>(new Set())
  if (!open) return null

  const chosen = finds.filter((f) => !off.has(f.brandKey))
  const n = chosen.length
  const toggle = (key: string) => setOff((p) => { const q = new Set(p); if (q.has(key)) q.delete(key); else q.add(key); return q })
  const addChosen = () => {
    chosen.forEach(resolve)
    onClose()
  }
  const notSubscriptions = () => {
    // Permanent and synced: the same answer the per-card "Not a subscription" gave.
    chosen.forEach((f) => settlePrompt(notASubscriptionKey(f.brandKey)))
    if (n === finds.length) onClose()
  }

  return (
    <ResolveSheet
      open
      onClose={onClose}
      title={sms.found(finds.length)}
      subtitle={`${sms.scanned(scanned)} · ${sms.nothingAdded}`}
      primary={finds.length === 0 ? { label: t.common.close, onPress: onClose } : { label: sms.addN(n), onPress: addChosen, disabled: n === 0 }}
      secondary={finds.length > 0 ? { label: sms.notASub, onPress: notSubscriptions, disabled: n === 0 } : undefined}
    >
      {finds.length === 0 ? <p className="py-6 text-center text-sm text-[var(--color-brand-text-secondary)]">{sms.none}</p> : null}
      {finds.map((f) => {
        const foreign = f.currency !== base
        const amount = foreign ? formatCurrency(f.amount, f.currency) : formatFixed2(f.amount)
        const approx = foreign ? `≈ ${currencyLabel(base, locale)} ${formatWhole(convertCurrency(f.amount, f.currency as Currency, base, rates))}` : null
        return (
          <ResolveRow
            key={f.brandKey}
            state={off.has(f.brandKey) ? 'idle' : 'selected'}
            onToggle={() => toggle(f.brandKey)}
            leading={<BrandTile brandKey={f.brandKey} name={f.name} size={40} />}
            title={f.name}
            sub={[sms.monthlyDay(f.billingDay), sms.confidence[f.confidence], approx].filter(Boolean).join(' · ')}
            trailing={amount}
            chip={f.match ? { tone: 'brand', text: sms.matches(f.match.name) } : undefined}
            label={`${f.name}, ${amount}, ${sms.monthlyDay(f.billingDay)}`}
            detail={<FindDetail find={f} />}
            detailLabels={{ show: t.smsReview.seeMessage, hide: t.smsReview.hideMessage }}
          />
        )
      })}
    </ResolveSheet>
  )
}
