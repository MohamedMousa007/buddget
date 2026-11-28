'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { CardSpotlight } from '@/components/features/membership/FlipCardRig'
import { GuestPassCard } from '@/components/features/membership/GuestPassCard'
import type { SiteLocale } from '@/lib/site/config'
import { siteContent } from '@/lib/site/routes'
import { APP_INVITE_CODE, WAITLIST_SHARE_CODE } from '@/lib/site/waitlist'

const fill = (t: string, v: Record<string, string>) => t.replace(/\{(\w+)\}/g, (_, k: string) => v[k] ?? '')

/** The member's own guest pass after joining: the app's invite pass, signed with their first name, carrying their code. */
export function MemberPass({ locale, code, name }: { locale: SiteLocale; code: string; name: string | null }) {
  const p = siteContent[locale].waitlist.pass
  return (
    <div className="grid gap-3">
      <CardSpotlight hint={p.tap}>
        <GuestPassCard
          flipLabel={p.flip}
          front={{
            mark: p.mark, title: p.title, subtitle: p.sub,
            from: name ? fill(p.from, { name }) : undefined,
            facts: [{ label: p.code, value: code, code: true }, { label: p.friendGets, value: p.friendValue }, { label: p.youGet, value: p.youWeek }],
          }}
          back={{ mark: p.backMark, benefits: p.benefits, footer: [fill(p.codeLine, { code }), p.sameEmail] }}
        />
      </CardSpotlight>
      <p className="text-sm text-brand-text-secondary">{p.terms}</p>
    </div>
  )
}

const readRef = (): string | null => {
  const raw = (new URLSearchParams(window.location.search).get('ref') ?? '').trim().toUpperCase()
  return WAITLIST_SHARE_CODE.test(raw) || APP_INVITE_CODE.test(raw) ? raw : null
}
const noSubscribe = () => () => {}

/** `?ref=` as a well-formed waitlist or in-app code; undefined while server-rendering (the page is static). */
export function useInviteRef(): string | null | undefined {
  return useSyncExternalStore(noSubscribe, readRef, () => undefined)
}

/** The invited friend's side: "Layla sent you a guest pass", the pass with what each of them gets, and the terms. */
export function InvitedPass({ locale, code }: { locale: SiteLocale; code: string }) {
  const w = siteContent[locale].waitlist
  const v = w.invite
  const p = w.pass
  const [name, setName] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    fetch(`/api/site/waitlist/pass?code=${encodeURIComponent(code)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((b: { name?: string | null } | null) => { if (live) setName(b?.name ?? null) })
      .catch(() => {})
    return () => { live = false }
  }, [code])

  return (
    <div className="grid gap-5">
      <div className="grid gap-2">
        <h1 className="font-heading text-4xl font-bold leading-[1.05] tracking-tight text-balance sm:text-5xl rtl:leading-tight rtl:tracking-normal">
          {name ? fill(v.title, { name }) : v.titleNoName}
        </h1>
        <p className="max-w-[46ch] text-lg text-brand-text-secondary">{v.sub}</p>
      </div>
      {/* The app draws the pass at phone size (322px); the landing's hero shows it larger on wide screens. */}
      <div className="lg:mb-24 lg:mt-4 lg:origin-top lg:scale-[1.4]">
        <CardSpotlight hint={v.tap}>
          <GuestPassCard
            flipLabel={v.flip}
            front={{
              mark: p.mark, title: p.title, subtitle: p.sub,
              from: name ? fill(p.from, { name }) : undefined,
              facts: [{ label: p.code, value: code, code: true }, { label: v.youGet, value: p.friendValue }, { label: name ? fill(v.inviterGets, { name }) : v.inviterGetsNoName, value: p.youWeek }],
            }}
            back={{ mark: v.backMark, benefits: v.benefits, footer: [fill(p.codeLine, { code }), p.sameEmail] }}
          />
        </CardSpotlight>
      </div>
      <p className="text-sm text-brand-text-secondary">{v.terms}</p>
    </div>
  )
}

/** Top of the invite landing: the inviter's pass when the link carries a valid code, the plain invite intro otherwise. */
export function InviteHero({ locale }: { locale: SiteLocale }) {
  const v = siteContent[locale].waitlist.invite
  const ref = useInviteRef()
  if (ref) return <InvitedPass locale={locale} code={ref} />
  return (
    <div className="grid gap-3">
      <h1 className="font-heading text-4xl font-bold leading-[1.05] tracking-tight text-balance sm:text-5xl rtl:leading-tight rtl:tracking-normal">{v.intro.h1}</h1>
      <p className="max-w-[46ch] text-lg text-brand-text-secondary">{ref === null ? v.noCode : v.intro.lede}</p>
    </div>
  )
}
