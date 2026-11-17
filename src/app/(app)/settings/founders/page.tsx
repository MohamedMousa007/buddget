'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/components/auth/AuthProvider'
import { CardSpotlight } from '@/components/features/membership/FlipCardRig'
import { FounderSignatureCard } from '@/components/features/membership/FounderSignatureCard'
import { MemberCard } from '@/components/features/membership/MemberCard'
import { MembershipPanel } from '@/components/features/membership/PointsList'
import { Fine, PageStack, Section, Sub, plainDate } from '@/components/features/rewards/pageParts'
import { MembershipHero } from '@/components/features/membership/MembershipHero'
import { SettingsSubPageShell } from '@/components/features/settings/SettingsSubPageShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { billingOn, useBillingStore } from '@/lib/billing/billingStore'
import { useLocale, useT } from '@/lib/i18n'
import { useMembershipCopy } from '@/lib/i18n/membershipCopy'
import { useRewardsCopy } from '@/lib/i18n/rewardsCopy'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
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
  const fc = useRewardsCopy().founders
  const t = useT()
  const { locale } = useLocale()
  const { user } = useAuth()
  const profileName = useFinanceStore((st) => st.profile.name) || t.common.user
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

  const tag = number !== null ? formatFounderNumber(number) : ''
  const joined = plainDate(user?.created_at, locale)

  return (
    <SettingsSubPageShell title={f.title}>
      <PageStack>
        {number !== null ? (
          <CardSpotlight hint={fc.tap}>
            <FounderSignatureCard
              flipLabel={fc.flip(number)}
              front={{ mark: fc.mark, number: tag, name: profileName, numberLabel: f.yourNumber, thanks: fc.thanks }}
              back={{ mark: fc.clubMark, perks: fc.backPerks(tag), footer: [joined ? fc.joined(joined) : '', fc.forGood] }}
            />
          </CardSpotlight>
        ) : (
          <MembershipHero tone="founder">
            <MemberCard kind="beta" mark={f.betaTitle} />
            <p dir="auto" className="text-sm leading-relaxed text-[var(--member-fg-2)]">{f.betaLine}</p>
          </MembershipHero>
        )}

        {number !== null ? (
          <>
            <Section title={fc.getTitle}>
              <MembershipPanel>
                {fc.perks.map((perk, i) => (
                  <div key={perk.t} dir="auto" className={i > 0 ? 'border-t border-[var(--color-brand-border)] px-4 py-[13px]' : 'px-4 py-[13px]'}>
                    <b className="block text-sm font-bold text-[var(--color-brand-text-primary)]">{perk.t}</b>
                    <Sub>{perk.d}</Sub>
                  </div>
                ))}
              </MembershipPanel>
              <Fine>{fc.fine}</Fine>
            </Section>

            <section className="grid gap-2">
              <label htmlFor="credit-name" dir="auto" className="block text-sm font-bold text-[var(--color-brand-text-primary)]">{f.nameLabel}</label>
              <Input id="credit-name" size="brand" dir="auto" value={name} maxLength={60} placeholder={f.namePlaceholder} onChange={(e) => { setName(e.target.value); setStatus('idle') }} />
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <Button size="touch" className="h-12 font-bold" loading={busy} disabled={!name.trim()} onClick={() => void send(name)}>{f.nameSend}</Button>
                <Button size="touch" variant="outline" className="h-12" disabled={busy} onClick={() => void send('')}>{f.nameClear}</Button>
              </div>
              {status === 'pending' ? <p role="status" dir="auto" className="text-[0.71875rem] text-[var(--color-brand-text-muted)]">{f.namePending}</p> : mine?.credit_name ? <p role="status" dir="auto" className="text-[0.71875rem] text-[var(--color-brand-text-muted)]">{f.nameApproved}</p> : null}
              <p dir="auto" className="text-[0.71875rem] text-[var(--color-brand-text-muted)]">{f.editNote}</p>
            </section>

            <div className="grid gap-1.5">
              <Button size="touch" variant="outline" onClick={() => void share()} className="w-full font-semibold">{f.share}</Button>
              {shareError ? <p role="status" className="text-xs text-[var(--color-brand-red)]">{f.shareFail}</p> : null}
            </div>
          </>
        ) : null}

        <Section title={f.creditsTitle}>
          <Sub>{f.creditsHint}</Sub>
          <MembershipPanel>
            {(credits ?? []).map((row, i) => (
              <div key={row.number} dir="ltr" className={`flex min-h-11 items-center gap-3.5 px-4 py-[13px] text-sm rtl:flex-row-reverse ${i > 0 ? 'border-t border-[var(--color-brand-border)]' : ''}`}>
                <b className="font-mono-numbers min-w-11 font-semibold text-[var(--color-brand-gold)]">{formatFounderNumber(row.number)}</b>
                <span dir="auto" className={row.credit_name ? 'text-[var(--color-brand-text-primary)]' : 'text-[var(--color-brand-text-muted)]'}>{row.credit_name ?? f.anon}{row.number === number ? ` · ${fc.you}` : ''}</span>
              </div>
            ))}
          </MembershipPanel>
        </Section>
      </PageStack>
    </SettingsSubPageShell>
  )
}
