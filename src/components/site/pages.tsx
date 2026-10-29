import type { ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { STORE_LINKS, SUPPORT_EMAIL, WEB_APP_URL, type SiteLocale } from '@/lib/site/config'
import { pathFor, siteContent } from '@/lib/site/routes'
import type { ScreenKey } from '@/lib/site/screens'
import { DailyNumberCalculator } from './DailyNumberCalculator'
import { EmergencyCalculator } from './EmergencyCalculator'
import { LeadForm } from './LeadForm'
import { PhoneShot } from './PhoneShot'
import { SocialLinks } from './SocialLinks'
import { HomeAfford } from './home/HomeAfford'
import { HomeHero } from './home/HomeHero'
import { HomeInside } from './home/HomeInside'
import { HomeStatement } from './home/HomeStatement'
import { HomeStory } from './home/HomeStory'
import { HomeClose, HomeCompare, HomeFaq, HomePricing, HomeProof, HomeTrust } from './home/HomeSections'
import { BottomCta, FaqList, PageHero, Reviews, Split, StoreBadges } from './sections'
import { ButtonLink, Card, Container, Eyebrow, H2, H3, Lede, Section, SectionHead, TextLink, Ticks } from './ui'

type P = { locale: SiteLocale }

/* ───────── Home ───────── */
export function HomePage({ locale }: P) {
  const st = siteContent[locale].landing.statement
  return (
    <>
      <HomeHero locale={locale} />
      <HomeProof locale={locale} />
      <HomeStatement parts={st} label={st.map((s) => s.text).join(' ')} />
      <HomeStory locale={locale} />
      <HomeAfford locale={locale} />
      <HomeInside locale={locale} />
      <HomeTrust locale={locale} />
      <HomeCompare locale={locale} />
      <HomePricing locale={locale} />
      <Reviews locale={locale} />
      <HomeFaq locale={locale} />
      <HomeClose locale={locale} />
    </>
  )
}

/* ───────── Features ───────── */
export function FeaturesHub({ locale }: P) {
  const c = siteContent[locale]
  const f = c.features
  return (
    <>
      <PageHero locale={locale} trail={[{ label: c.footer.links.features }]} eyebrow={f.intro.eyebrow} h1={f.intro.h1} lede={f.intro.lede} />
      <Section pad="md">
        <Container>
          <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {f.items.map((it, i) => (
              <li key={it.slug}>
                <Link href={pathFor(locale, `features/${it.slug}`)} className={`flex h-full flex-col gap-3 rounded-2xl border bg-brand-card p-7 transition-colors hover:border-brand-primary ${i === 0 ? 'border-brand-primary' : 'border-brand-border'}`}>
                  {i === 0 ? <span className="inline-flex self-start rounded-full border border-brand-border px-3 py-1 text-xs font-medium text-brand-text-secondary">{f.core}</span> : null}
                  <H3 as="h2">{it.name}</H3>
                  <p className="text-brand-text-secondary">{it.short}</p>
                  <span className="mt-auto pt-2 font-semibold text-brand-primary-ink">{c.common.readMore} <span aria-hidden className="inline-block rtl:rotate-180">→</span></span>
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </Section>
      <BottomCta locale={locale} title={c.how.ctaH} text={c.how.ctaP} />
    </>
  )
}

export function FeaturePage({ locale, slug }: P & { slug: string }) {
  const c = siteContent[locale]
  const it = c.features.items.find((x) => x.slug === slug)
  if (!it) return null
  return (
    <>
      <PageHero locale={locale} trail={[{ label: c.footer.links.features, slug: 'features' }, { label: it.name }]} eyebrow={c.features.intro.eyebrow} h1={it.h1} lede={it.lede}>
        <div className="flex flex-wrap gap-3"><ButtonLink href={pathFor(locale, 'download')} size="lg">{c.common.getApp}</ButtonLink><ButtonLink href={pathFor(locale, 'features')} variant="outline" size="lg">{c.footer.links.features}</ButtonLink></div>
      </PageHero>
      <Section pad="lg">
        <Container>
          <Split visual={<PhoneShot screen={it.screen} locale={locale} />}>
            <H2 className="sm:text-4xl">{it.heading}</H2>
            <Lede>{it.body}</Lede>
            <Ticks items={it.bullets} />
          </Split>
        </Container>
      </Section>
      <Section pad="md" tone="card">
        <Container narrow><div className="mb-6"><H2>{c.home.faq.h2}</H2></div><FaqList items={it.faq} /></Container>
      </Section>
      <Section pad="sm">
        <Container>
          <p className="mb-4 font-semibold">{c.guides.relatedH}</p>
          <ul className="flex flex-wrap gap-3">
            {c.features.items.filter((x) => x.slug !== slug).slice(0, 4).map((x) => (
              <li key={x.slug}><Link href={pathFor(locale, `features/${x.slug}`)} className="inline-flex min-h-11 items-center rounded-full border border-brand-border bg-brand-card px-4 text-sm font-medium hover:border-brand-primary">{x.name}</Link></li>
            ))}
          </ul>
        </Container>
      </Section>
      <BottomCta locale={locale} title={c.how.ctaH} text={c.how.ctaP} />
    </>
  )
}

/* ───────── How it works ───────── */
export function HowPage({ locale }: P) {
  const c = siteContent[locale]
  return (
    <>
      <PageHero locale={locale} trail={[{ label: c.footer.links.how }]} eyebrow={c.how.intro.eyebrow} h1={c.how.intro.h1} lede={c.how.intro.lede} />
      <Section pad="lg">
        <Container className="flex flex-col gap-24">
          {c.how.steps.map((s, i) => (
            <Split key={s.n} reverse={i % 2 === 1} visual={<PhoneShot screen={s.screen} locale={locale} size="sm" />}>
              <span className="font-mono text-sm tracking-widest text-brand-primary-ink">{s.n}</span>
              <H2 className="sm:text-4xl">{s.h}</H2>
              <Lede>{s.p}</Lede>
            </Split>
          ))}
        </Container>
      </Section>
      <BottomCta locale={locale} title={c.how.ctaH} text={c.how.ctaP} />
    </>
  )
}

/* ───────── Pricing ───────── */
export function PricingPage({ locale }: P) {
  const c = siteContent[locale]
  const p = c.pricing
  return (
    <>
      <PageHero locale={locale} trail={[{ label: c.footer.links.pricing }]} eyebrow={p.intro.eyebrow} h1={p.intro.h1} lede={p.intro.lede} />
      <Section pad="md">
        <Container>
          <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
            <Card className="flex flex-col gap-5 border-brand-primary">
              <div><H3 as="h2" className="text-2xl">{p.free.name}</H3><p className="mt-1 text-brand-text-secondary">{p.free.tag}</p></div>
              <div dir="auto" className="font-mono text-5xl font-medium">{p.free.price}</div>
              <Ticks items={p.free.items} />
              <div className="mt-auto grid gap-2"><ButtonLink href={pathFor(locale, 'download')}>{p.free.cta}</ButtonLink><ButtonLink href={WEB_APP_URL} variant="ghost" external>{c.common.tryBrowser}</ButtonLink></div>
            </Card>
            <Card className="flex flex-col gap-5">
              <div><H3 as="h2" className="text-2xl">{p.plus.name}</H3><p className="mt-1 text-brand-text-secondary">{p.plus.tag}</p></div>
              <div dir="auto" className="font-mono text-3xl font-medium text-brand-text-secondary">{p.plus.price}</div>
              <Ticks items={p.plus.items} />
              <ButtonLink href={pathFor(locale, 'download')} variant="outline" className="mt-auto">{p.plus.cta}</ButtonLink>
            </Card>
          </div>
          <p className="mx-auto mt-6 max-w-4xl text-sm text-brand-text-secondary">{p.note}</p>
        </Container>
      </Section>
      <Section pad="md" tone="card"><Container narrow><FaqList items={p.faq} /></Container></Section>
    </>
  )
}

/* ───────── Download ───────── */
export function DownloadPage({ locale }: P) {
  const c = siteContent[locale]
  const d = c.download
  const storesLive = Boolean(STORE_LINKS.appStore || STORE_LINKS.googlePlay)
  return (
    <>
      <PageHero locale={locale} trail={[{ label: c.footer.links.download }]} eyebrow={d.intro.eyebrow} h1={d.intro.h1} lede={d.intro.lede}>
        <StoreBadges locale={locale} />
        <div className="flex flex-wrap items-center gap-3"><ButtonLink href={WEB_APP_URL} variant="outline" external>{c.common.tryBrowser}</ButtonLink><span className="text-sm text-brand-text-secondary">{c.common.noInstall} {c.common.haveAccount} <a href={WEB_APP_URL} className="inline-flex min-h-11 items-center font-semibold text-brand-primary-ink hover:underline">{c.common.logIn}</a></span></div>
      </PageHero>
      {!storesLive ? (
        <Section pad="md" id="beta">
          <Container narrow>
            <Card className="grid gap-5 bg-brand-primary-soft sm:p-9">
              <div><H2 className="text-3xl">{d.betaH}</H2><p className="mt-2 text-brand-text-secondary">{d.betaP}</p></div>
              <LeadForm kind="waitlist" locale={locale} inline labels={{ email: d.emailLabel, placeholder: d.emailPlaceholder, submit: d.submit, sent: d.sent, error: d.error }} />
              <SocialLinks label={c.footer.follow} />
            </Card>
          </Container>
        </Section>
      ) : null}
      <Section pad="md">
        <Container>
          <ol className="grid gap-6 md:grid-cols-3">
            {d.steps.map((s, i) => (
              <li key={s.h} className="flex flex-col gap-2 rounded-2xl border border-brand-border bg-brand-card p-6">
                <span className="font-mono text-sm tracking-widest text-brand-primary-ink">0{i + 1}</span>
                <H3>{s.h}</H3>
                <p className="text-brand-text-secondary">{s.p}</p>
              </li>
            ))}
          </ol>
        </Container>
      </Section>
    </>
  )
}

/* ───────── Security ───────── */
export function SecurityPage({ locale }: P) {
  const c = siteContent[locale]
  const s = c.security
  return (
    <>
      <PageHero locale={locale} trail={[{ label: c.footer.links.security }]} eyebrow={s.intro.eyebrow} h1={s.intro.h1} lede={s.intro.lede} />
      <Section pad="md">
        <Container>
          <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {s.cards.map((x) => <li key={x.h}><Card className="h-full"><H3 as="h2">{x.h}</H3><p className="mt-2 text-brand-text-secondary">{x.p}</p></Card></li>)}
          </ul>
        </Container>
      </Section>
      <Section pad="md" tone="card">
        <Container narrow>
          <H2 className="mb-6 text-3xl">{s.dataH}</H2>
          <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-[200px_1fr]">
            {s.data.map((d) => (<div key={d.k} className="contents"><dt className="font-semibold">{d.k}</dt><dd className="text-brand-text-secondary">{d.v}</dd></div>))}
          </dl>
          <div className="mt-8"><ButtonLink href="/legal/privacy" variant="outline" external>{s.policyCta}</ButtonLink></div>
        </Container>
      </Section>
      <Section pad="md"><Container narrow><FaqList items={s.faq} /></Container></Section>
    </>
  )
}

/* ───────── Support ───────── */
export function SupportPage({ locale }: P) {
  const c = siteContent[locale]
  const s = c.support
  return (
    <>
      <PageHero locale={locale} trail={[{ label: c.footer.links.support }]} eyebrow={s.intro.eyebrow} h1={s.intro.h1} lede={s.intro.lede} />
      <Section pad="md">
        <Container narrow className="grid gap-12">
          {s.groups.map((g) => (<div key={g.h}><H2 className="mb-4 text-2xl">{g.h}</H2><FaqList items={g.items} /></div>))}
          <Card className="grid gap-2 bg-brand-primary-soft">
            <H3>{s.stillH}</H3>
            <p className="text-brand-text-secondary">{s.stillP}</p>
            <p className="text-sm text-brand-text-secondary">{s.inApp}</p>
            <div className="pt-2"><ButtonLink href={pathFor(locale, 'contact')}>{c.common.contactUs}</ButtonLink></div>
          </Card>
        </Container>
      </Section>
    </>
  )
}

/* ───────── Contact ───────── */
export function ContactPage({ locale }: P) {
  const c = siteContent[locale]
  const t = c.contact
  return (
    <>
      <PageHero locale={locale} trail={[{ label: c.footer.links.contact }]} eyebrow={t.intro.eyebrow} h1={t.intro.h1} lede={t.intro.lede} />
      <Section pad="md">
        <Container>
          <div className="flex flex-col gap-10 md:flex-row">
            <Card className="md:flex-1 md:basis-[460px]">
              <H3 className="mb-5">{t.formH}</H3>
              <LeadForm kind="contact" locale={locale} labels={{ name: t.name, email: t.email, message: t.message, submit: t.send, sent: t.sent, error: t.error }} />
              <p className="mt-4 text-sm text-brand-text-secondary">{t.responseNote}</p>
            </Card>
            <div className="grid content-start gap-5 md:flex-1 md:basis-[320px]">
              <Card><H3 as="h2">{t.emailH}</H3><p className="mt-2 text-brand-text-secondary">{t.emailP}</p><a dir="ltr" href={`mailto:${SUPPORT_EMAIL}`} className="mt-3 inline-flex min-h-11 items-center font-semibold text-brand-primary-ink hover:underline">{SUPPORT_EMAIL}</a></Card>
              <Card><H3 as="h2">{t.appH}</H3><p className="mt-2 text-brand-text-secondary">{t.appP}</p></Card>
              <Card><H3 as="h2" className="mb-3">{t.followH}</H3><SocialLinks label={c.footer.follow} /></Card>
            </div>
          </div>
        </Container>
      </Section>
    </>
  )
}

/* ───────── About ───────── */
export function AboutPage({ locale }: P) {
  const c = siteContent[locale]
  const a = c.about
  return (
    <>
      <PageHero locale={locale} trail={[{ label: c.footer.links.about }]} eyebrow={a.intro.eyebrow} h1={a.intro.h1} lede={a.intro.lede} />
      <Section pad="md">
        <Container>
          <ul className="grid gap-5 md:grid-cols-3">{a.pillars.map((p) => <li key={p.h}><Card className="h-full"><H3 as="h2">{p.h}</H3><p className="mt-2 text-brand-text-secondary">{p.p}</p></Card></li>)}</ul>
        </Container>
      </Section>
      <Section pad="md" tone="card">
        <Container narrow>
          <H2 className="mb-5 text-3xl">{a.storyH}</H2>
          <div className="grid gap-4 text-lg leading-relaxed text-brand-text-secondary">{a.story.map((p) => <p key={p}>{p}</p>)}</div>
          <div className="mt-10"><H3 className="mb-2">{a.followH}</H3><p className="mb-4 text-brand-text-secondary">{a.followP}</p><SocialLinks label={c.footer.follow} /></div>
        </Container>
      </Section>
    </>
  )
}

/* ───────── Press ───────── */
export function PressPage({ locale }: P) {
  const c = siteContent[locale]
  const p = c.press
  const shots: ScreenKey[] = locale === 'ar' ? ['flow-ar', 'goals-ar', 'buddgy-ar', 'accounts-ar'] : ['flow', 'goals', 'buddgy-2', 'accounts']
  return (
    <>
      <PageHero locale={locale} trail={[{ label: c.footer.links.press }]} eyebrow={p.intro.eyebrow} h1={p.intro.h1} lede={p.intro.lede} />
      <Section pad="md">
        <Container>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="grid gap-4">
              <H3>{p.aboutH}</H3>
              <p className="text-brand-text-secondary">{p.boilerplate}</p>
              <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[140px_1fr]">{p.facts.map((f) => (<div key={f.k} className="contents"><dt className="text-brand-text-secondary">{f.k}</dt><dd>{f.v}</dd></div>))}</dl>
            </Card>
            <Card className="grid gap-4">
              <H3>{p.logoH}</H3>
              <div className="flex flex-wrap gap-4">
                <div className="grid min-h-28 flex-1 basis-44 place-items-center rounded-2xl border border-brand-border bg-brand-bg"><Image src="/icons/icon-192.png" alt="Buddget" width={64} height={64} unoptimized /></div>
              </div>
              <H3>{p.colorsH}</H3>
              <ul className="grid grid-cols-2 gap-3">
                {p.colors.map((x) => (<li key={x.hex} className="overflow-hidden rounded-2xl border border-brand-border"><div className="h-16" style={{ background: x.hex }} /><div className="p-3"><b>{x.name}</b><div dir="ltr" className="font-mono text-sm text-brand-text-secondary">{x.hex}</div></div></li>))}
              </ul>
            </Card>
          </div>
        </Container>
      </Section>
      <Section pad="md" tone="card"><Container><H3 className="mb-6">{p.screensH}</H3><div className="flex flex-wrap justify-center gap-8">{shots.map((s) => <PhoneShot key={s} screen={s} locale={locale} size="sm" />)}</div></Container></Section>
      <Section pad="md"><Container><Card className="flex flex-wrap items-center justify-between gap-5"><div><H3>{p.contactH}</H3><p className="text-brand-text-secondary">{p.contactP}</p></div><ButtonLink href={`mailto:${SUPPORT_EMAIL}`} external>{SUPPORT_EMAIL}</ButtonLink></Card></Container></Section>
    </>
  )
}

/* ───────── Buddgy facts ───────── */
export function AiPage({ locale }: P) {
  const c = siteContent[locale]
  const a = c.ai
  return (
    <>
      <PageHero locale={locale} trail={[{ label: c.footer.links.ai }]} eyebrow={a.intro.eyebrow} h1={a.intro.h1} lede={a.intro.lede} />
      <Section pad="md">
        <Container narrow>
          <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-[180px_1fr]">{a.facts.map((f) => (<div key={f.k} className="contents"><dt className="font-semibold">{f.k}</dt><dd className="text-brand-text-secondary">{f.v}</dd></div>))}</dl>
          <p className="mt-10 text-sm text-brand-text-secondary">{a.updated}</p>
        </Container>
      </Section>
    </>
  )
}

/* ───────── Guides ───────── */
export function GuidesIndex({ locale }: P) {
  const c = siteContent[locale]
  const g = c.guides
  return (
    <>
      <PageHero locale={locale} trail={[{ label: c.footer.links.guides }]} eyebrow={g.intro.eyebrow} h1={g.intro.h1} lede={g.intro.lede} />
      <Section pad="md">
        <Container>
          <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {g.items.map((x) => (
              <li key={x.slug}>
                <Link href={pathFor(locale, `guides/${x.slug}`)} className="flex h-full flex-col gap-3 rounded-2xl border border-brand-border bg-brand-card p-7 hover:border-brand-primary">
                  <span className="inline-flex self-start rounded-lg bg-brand-primary-soft px-2.5 py-1 text-xs font-semibold text-brand-primary-ink">{x.category}</span>
                  <H3>{x.title}</H3>
                  <p className="text-brand-text-secondary">{x.description}</p>
                  <span className="mt-auto pt-2 text-sm text-brand-text-secondary"><span dir="ltr">{x.minutes}</span> {g.minLabel}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </Section>
    </>
  )
}

export function GuidePage({ locale, slug }: P & { slug: string }) {
  const c = siteContent[locale]
  const g = c.guides.items.find((x) => x.slug === slug)
  if (!g) return null
  const toolSlug = slug === 'emergency-fund-plan' ? 'tools/emergency-fund' : 'tools/daily-spending-number'
  return (
    <>
      <PageHero locale={locale} trail={[{ label: c.footer.links.guides, slug: 'guides' }, { label: g.category }]} eyebrow={g.category} h1={g.title}>
        <p className="text-sm text-brand-text-secondary"><span dir="ltr">{g.minutes}</span> {c.guides.minLabel} · <time dateTime={g.published}>{g.published}</time></p>
      </PageHero>
      <Section pad="md">
        <Container narrow>
          <article className="grid gap-6 text-lg leading-relaxed">
            <p className="rounded-2xl bg-brand-primary-soft p-6 font-medium">{g.answer}</p>
            {g.sections.map((s) => (
              <div key={s.h} className="grid gap-3"><H2 className="mt-4 text-2xl sm:text-2xl">{s.h}</H2>{s.p.map((p) => <p key={p} className="text-brand-text-secondary">{p}</p>)}</div>
            ))}
          </article>
          <div className="mt-12 flex flex-wrap gap-3"><ButtonLink href={pathFor(locale, toolSlug)}>{g.cta}</ButtonLink><ButtonLink href={pathFor(locale, 'download')} variant="outline">{c.common.getApp}</ButtonLink></div>
        </Container>
      </Section>
      <Section pad="sm" tone="card">
        <Container>
          <p className="mb-4 font-semibold">{c.guides.relatedH}</p>
          <ul className="flex flex-wrap gap-3">{c.guides.items.filter((x) => x.slug !== slug).map((x) => (<li key={x.slug}><Link href={pathFor(locale, `guides/${x.slug}`)} className="inline-flex min-h-11 items-center rounded-full border border-brand-border bg-brand-bg px-4 text-sm font-medium hover:border-brand-primary">{x.title}</Link></li>))}</ul>
        </Container>
      </Section>
    </>
  )
}

/* ───────── Tools ───────── */
export function ToolsHub({ locale }: P) {
  const c = siteContent[locale]
  const t = c.tools
  return (
    <>
      <PageHero locale={locale} trail={[{ label: c.footer.links.tools }]} eyebrow={t.intro.eyebrow} h1={t.intro.h1} lede={t.intro.lede} />
      <Section pad="md">
        <Container>
          <ul className="grid gap-5 md:grid-cols-2">
            {t.items.map((x) => (
              <li key={x.slug}><Link href={pathFor(locale, `tools/${x.slug}`)} className="flex h-full flex-col gap-2 rounded-2xl border border-brand-border bg-brand-card p-7 hover:border-brand-primary"><H3>{x.name}</H3><p className="text-brand-text-secondary">{x.desc}</p></Link></li>
            ))}
          </ul>
        </Container>
      </Section>
    </>
  )
}

function ToolFrame({ locale, name, intro, explainH, explain, cta, children }: P & { name: string; intro: { eyebrow: string; h1: string; lede: string }; explainH: string; explain: string[]; cta: string; children: ReactNode }) {
  const c = siteContent[locale]
  return (
    <>
      <PageHero locale={locale} trail={[{ label: c.footer.links.tools, slug: 'tools' }, { label: name }]} eyebrow={intro.eyebrow} h1={intro.h1} lede={intro.lede} />
      <Section pad="md"><Container narrow>{children}</Container></Section>
      <Section pad="md" tone="card">
        <Container narrow>
          <H2 className="mb-4 text-2xl sm:text-2xl">{explainH}</H2>
          <div className="grid gap-3 text-lg leading-relaxed text-brand-text-secondary">{explain.map((p) => <p key={p}>{p}</p>)}</div>
          <div className="mt-8"><ButtonLink href={pathFor(locale, 'download')}>{cta}</ButtonLink></div>
        </Container>
      </Section>
    </>
  )
}

export function DailyToolPage({ locale }: P) {
  const t = siteContent[locale].tools
  return <ToolFrame locale={locale} name={t.items[0].name} intro={t.daily.intro} explainH={t.daily.explainH} explain={t.daily.explain} cta={t.daily.cta}><DailyNumberCalculator locale={locale} /></ToolFrame>
}

export function EmergencyToolPage({ locale }: P) {
  const t = siteContent[locale].tools
  return <ToolFrame locale={locale} name={t.items[1].name} intro={t.emergency.intro} explainH={t.emergency.explainH} explain={t.emergency.explain} cta={t.emergency.cta}><EmergencyCalculator locale={locale} /></ToolFrame>
}

/* ───────── Delete account ───────── */
export function DeleteAccountPage({ locale }: P) {
  const c = siteContent[locale]
  const d = c.deleteAccount
  return (
    <>
      <PageHero locale={locale} trail={[{ label: c.footer.links.delete }]} eyebrow={d.intro.eyebrow} h1={d.intro.h1} lede={d.intro.lede} />
      <Section pad="md">
        <Container narrow className="grid gap-8">
          <Card>
            <H2 className="mb-4 text-2xl sm:text-2xl">{d.appH}</H2>
            <ol className="grid gap-3">{d.steps.map((s, i) => (<li key={s} className="flex gap-4"><span className="grid size-8 flex-none place-items-center rounded-full bg-brand-primary-soft font-mono text-sm font-semibold text-brand-primary-ink">{i + 1}</span><span className="pt-0.5 text-lg">{s}</span></li>))}</ol>
          </Card>
          <Card>
            <H3>{d.emailH}</H3>
            <p className="mt-2 text-brand-text-secondary">{d.emailP}</p>
            <div className="mt-4"><ButtonLink href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(d.mailSubject)}`} variant="outline" external>{SUPPORT_EMAIL}</ButtonLink></div>
          </Card>
          <div className="grid gap-6 sm:grid-cols-2">
            <div><H3 className="mb-3">{d.whatH}</H3><Ticks items={d.what} /></div>
            <div><H3 className="mb-3">{d.keepH}</H3><p className="text-brand-text-secondary">{d.keep}</p></div>
          </div>
        </Container>
      </Section>
    </>
  )
}

/* ───────── Glossary ───────── */
export function GlossaryPage({ locale }: P) {
  const c = siteContent[locale]
  const g = c.glossary
  return (
    <>
      <PageHero locale={locale} trail={[{ label: c.footer.links.glossary }]} eyebrow={g.intro.eyebrow} h1={g.intro.h1} lede={g.intro.lede} />
      <Section pad="md"><Container narrow><dl className="grid gap-6">{g.terms.map((t) => (<div key={t.term} id={t.term} className="rounded-2xl border border-brand-border bg-brand-card p-6"><dt className="text-xl font-semibold">{t.term}</dt><dd className="mt-1 text-brand-text-secondary">{t.def}</dd></div>))}</dl></Container></Section>
    </>
  )
}

/* ───────── Compare ───────── */
export function ComparePage({ locale }: P) {
  const c = siteContent[locale]
  const m = c.compare
  return (
    <>
      <PageHero locale={locale} trail={[{ label: m.intro.h1 }]} eyebrow={m.intro.eyebrow} h1={m.intro.h1} lede={m.intro.lede} />
      <Section pad="md">
        <Container>
          <div className="overflow-x-auto rounded-2xl border border-brand-border bg-brand-card">
            <table className="w-full min-w-[560px] border-collapse text-start">
              <thead><tr className="border-b border-brand-border text-start"><th scope="col" className="p-4"><span className="sr-only">{m.intro.eyebrow}</span></th><th scope="col" className="p-4 text-start font-semibold text-brand-primary-ink">{m.cols[0]}</th><th scope="col" className="p-4 text-start font-semibold">{m.cols[1]}</th></tr></thead>
              <tbody>{m.rows.map((r) => (<tr key={r.f} className="border-b border-brand-border last:border-0"><th scope="row" className="p-4 text-start font-medium">{r.f}</th><td className="p-4 font-medium text-brand-primary-ink">{r.a}</td><td className="p-4 text-brand-text-secondary">{r.b}</td></tr>))}</tbody>
            </table>
          </div>
          <Card className="mt-8 max-w-3xl"><H3 as="h2">{m.honestH}</H3><p className="mt-2 text-brand-text-secondary">{m.honest}</p></Card>
        </Container>
      </Section>
      <BottomCta locale={locale} title={m.cta} />
    </>
  )
}

/* ───────── Cookies ───────── */
export function CookiesPage({ locale }: P) {
  const c = siteContent[locale]
  const k = c.cookies
  return (
    <>
      <PageHero locale={locale} trail={[{ label: c.footer.links.cookies }]} eyebrow={k.intro.eyebrow} h1={k.intro.h1} lede={k.intro.lede} />
      <Section pad="md"><Container narrow className="grid gap-8">{k.sections.map((s) => (<div key={s.h}><H3>{s.h}</H3><p className="mt-2 text-lg text-brand-text-secondary">{s.p}</p></div>))}</Container></Section>
    </>
  )
}

/* ───────── Not found ───────── */
export function NotFoundView({ locale }: P) {
  const n = siteContent[locale].notFound
  return (
    <Section dark pad="lg" className="min-h-[70vh]">
      <Container className="flex flex-col items-center gap-6 text-center">
        <Eyebrow>404</Eyebrow>
        <H2 as="h1" className="max-w-[18ch]">{n.h}</H2>
        <Lede className="mx-auto">{n.p}</Lede>
        <div className="flex flex-wrap justify-center gap-3"><ButtonLink href={pathFor(locale, '')}>{n.home}</ButtonLink><ButtonLink href={pathFor(locale, 'support')} variant="outline">{n.help}</ButtonLink></div>
      </Container>
    </Section>
  )
}
