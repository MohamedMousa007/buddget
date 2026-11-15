'use client'

import { useCallback, useEffect, useState } from 'react'
import { Share2 } from 'lucide-react'
import { MemberCard } from '@/components/features/membership/MemberCard'
import { MembershipHero } from '@/components/features/membership/MembershipHero'
import { SettingsSubPageShell } from '@/components/features/settings/SettingsSubPageShell'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { billingOn, useBillingStore } from '@/lib/billing/billingStore'
import { useMembershipCopy } from '@/lib/i18n/membershipCopy'
import { founderCardImage, shareOrSaveImage } from '@/lib/loyalty/founderCardImage'
import { fetchCredits, formatFounderNumber, requestCreditName, type CreditRow } from '@/lib/loyalty/loyaltyApi'
import { navigate } from '@/lib/navigation/navigate'

/**
 * The Founders club: a numbered card, what founders get, the credits list with an opt-in name, and the card as an image.
 * Reached from the badge in Settings and a row on the Pro page; only founders and beta testers see it. Gold is for founders only.
 */
export default function FoundersPage() {
  const c = useMembershipCopy()
  const f = c.founders
  const me = useBillingStore((s) => s.me)
  const on = billingOn(me)
  const loyalty = me?.loyalty ?? null
  const number = loyalty?.founderNumber ?? null
  const isBeta = !!loyalty?.betaTester
  const allowed = number !== null || isBeta

  const [credits, setCredits] = useState<CreditRow[] | null>(null)
  const [name, setName] = useState('')
  const [status, setStatus] = useState<'idle' | 'pending' | 'saved'>('idle')
  const [busy, setBusy] = useState(false)
  const [shareError, setShareError] = useState(false)

  useEffect(() => {
    if (me && (!on || !allowed)) navigate('/settings', { replace: true })
  }, [me, on, allowed])

  const load = useCallback(() => { void fetchCredits().then(setCredits) }, [])
  useEffect(() => { if (allowed && on) load() }, [allowed, on, load])

  if (!me || !on || !allowed) return null
  const mine = number !== null ? credits?.find((r) => r.number === number) : undefined

  const send = async (value: string) => {
    setBusy(true)
    const out = await requestCreditName(value)
    setBusy(false)
    if (out === 'pending') setStatus('pending')
    if (out === 'cleared') { setStatus('idle'); setName('') }
    load()
  }

  const share = async () => {
    if (number === null) return
    setShareError(false)
    const blob = await founderCardImage({ number: formatFounderNumber(number), mark: f.mark, wordmark: c.proName.replace(' Pro', '') })
    if (!blob || !(await shareOrSaveImage(blob, `founder-${formatFounderNumber(number).slice(1)}.png`))) setShareError(true)
  }

  return (
    <SettingsSubPageShell title={f.title} backHref="/settings/pro">
      <div className="space-y-5">
        <MembershipHero tone="founder">
          {number !== null ? (
            <MemberCard kind="founder" mark={f.mark} number={formatFounderNumber(number)} facts={[{ label: f.yourNumber, value: formatFounderNumber(number) }]} />
          ) : (
            <MemberCard kind="beta" mark={f.betaTitle} />
          )}
          <p dir="auto" className="text-sm leading-relaxed text-[var(--member-fg-2)]">{number !== null ? f.heroLine : f.betaLine}</p>
        </MembershipHero>

        {number !== null ? (
          <>
            <section className="space-y-2">
              <h2 dir="auto" className="text-xl font-extrabold tracking-tight text-[var(--color-brand-text-primary)] rtl:font-bold rtl:tracking-normal">{f.perksTitle}</h2>
              <Card padding="md" divide>
                {f.perks.map((perk) => (
                  <div key={perk.t} dir="auto" className="py-2.5 first:pt-0 last:pb-0">
                    <p className="text-sm font-bold text-[var(--color-brand-text-primary)]">{perk.t}</p>
                    <p className="mt-0.5 text-[0.8125rem] leading-snug text-[var(--color-brand-text-secondary)]">{perk.d}</p>
                  </div>
                ))}
              </Card>
              <p dir="auto" className="rounded-[14px] bg-[var(--color-brand-elevated)] px-3.5 py-3 text-[0.8125rem] leading-snug text-[var(--color-brand-text-secondary)]">{f.fact}</p>
            </section>

            <section className="space-y-2">
              <label htmlFor="credit-name" dir="auto" className="block text-sm font-bold text-[var(--color-brand-text-primary)]">{f.nameLabel}</label>
              <Input id="credit-name" size="brand" dir="auto" value={name} maxLength={60} placeholder={f.namePlaceholder} onChange={(e) => { setName(e.target.value); setStatus('idle') }} />
              <div className="flex gap-2">
                <Button size="touch" className="flex-1 font-semibold" loading={busy} disabled={!name.trim()} onClick={() => void send(name)}>{f.nameSend}</Button>
                <Button size="touch" variant="ghost" disabled={busy} onClick={() => void send('')}>{f.nameClear}</Button>
              </div>
              {status === 'pending' ? <p role="status" dir="auto" className="text-xs text-[var(--color-brand-text-secondary)]">{f.namePending}</p> : mine?.credit_name ? <p role="status" dir="auto" className="text-xs text-[var(--color-brand-text-secondary)]">{f.nameApproved}</p> : null}
              <p dir="auto" className="text-xs text-[var(--color-brand-text-muted)]">{f.editNote}</p>
            </section>

            <div className="space-y-1.5">
              <Button size="cta-block" variant="outline" onClick={() => void share()} className="font-semibold"><Share2 aria-hidden />{f.share}</Button>
              {shareError ? <p role="status" className="text-xs text-[var(--color-brand-red)]">{f.shareFail}</p> : null}
            </div>
          </>
        ) : null}

        <section className="space-y-2">
          <h2 dir="auto" className="text-xl font-extrabold tracking-tight text-[var(--color-brand-text-primary)] rtl:font-bold rtl:tracking-normal">{f.creditsTitle}</h2>
          <p dir="auto" className="text-[0.8125rem] leading-snug text-[var(--color-brand-text-secondary)]">{f.creditsHint}</p>
          <Card padding="none" divide className="overflow-hidden">
            {(credits ?? []).map((row) => (
              <div key={row.number} dir="ltr" className="grid min-h-[52px] grid-cols-[64px_minmax(0,1fr)] items-center gap-2.5 px-4">
                <span className="font-mono-numbers text-[0.9375rem] font-semibold text-[var(--color-brand-gold)]">{formatFounderNumber(row.number)}</span>
                <span dir="auto" className={row.credit_name ? 'text-sm text-[var(--color-brand-text-primary)]' : 'text-sm text-[var(--color-brand-text-secondary)]'}>{row.credit_name ?? f.anon}</span>
              </div>
            ))}
          </Card>
        </section>
      </div>
    </SettingsSubPageShell>
  )
}
