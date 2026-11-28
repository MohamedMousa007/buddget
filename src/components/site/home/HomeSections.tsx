import Link from 'next/link'
import type { SiteLocale } from '@/lib/site/config'
import { pathFor, siteContent } from '@/lib/site/routes'
import { PlanCards, StoreBadges } from '../sections'

export function HomeProof({ locale }: { locale: SiteLocale }) {
  const p = siteContent[locale].landing.proof
  return (
    <section className="proof" aria-label={p.label}>
      <div className="wrap">
        <ul>{p.items.map((i) => <li key={i.t}><b>{i.v}</b><span>{i.t}</span></li>)}</ul>
        <p>{p.note}</p>
      </div>
    </section>
  )
}

export function HomeCompare({ locale }: { locale: SiteLocale }) {
  const c = siteContent[locale].landing.compare
  return (
    <section className="cmp sec" id="cmp">
      <div className="wrap">
        <h2 className="h2">{c.h2}</h2>
        <div className="cmp-t" tabIndex={0} role="region" aria-label={c.h2}>
          <table>
            <thead><tr>{c.cols.map((x, i) => <th key={i} scope="col" className={i === 1 ? 'me' : undefined}>{x || <span className="sr">{c.rows[0][0]}</span>}</th>)}</tr></thead>
            <tbody>{c.rows.map((r) => <tr key={r[0]}><th scope="row">{r[0]}</th><td className="me">{r[1]}</td><td>{r[2]}</td><td>{r[3]}</td></tr>)}</tbody>
          </table>
        </div>
        <p className="cmp-note">{c.note}</p>
      </div>
    </section>
  )
}

export function HomePricing({ locale }: { locale: SiteLocale }) {
  const p = siteContent[locale].landing.pricing
  return (
    <section className="price sec alt band" id="price">
      <div className="wrap">
        <h2 className="h2">{p.h2}</h2>
        <p className="sub" style={{ marginBottom: 'clamp(28px,4vw,48px)' }}>{p.p}</p>
        <PlanCards locale={locale} heading="h3" />
        <p style={{ marginTop: 20 }}><Link className="lnk" href={pathFor(locale, p.link.slug)}>{p.link.label} <span aria-hidden>{locale === 'ar' ? '←' : '→'}</span></Link></p>
      </div>
    </section>
  )
}

export function HomeFaq({ locale }: { locale: SiteLocale }) {
  const f = siteContent[locale].home.faq
  return (
    <section className="faq-s sec alt band" id="faq">
      <div className="wrap">
        <h2 className="h2">{f.h2}</h2>
        <div className="faq-w" style={{ marginTop: 'clamp(28px,4vw,48px)' }}>
          {f.items.map((q, i) => <details key={q.q} open={i === 0}><summary>{q.q}</summary><p>{q.a}</p></details>)}
        </div>
      </div>
    </section>
  )
}

export function HomeClose({ locale }: { locale: SiteLocale }) {
  const c = siteContent[locale]
  const k = c.landing.close
  return (
    <section className="close" id="close">
      <div className="wrap close-grid" style={{ gridTemplateColumns: 'minmax(0,1fr)', paddingBottom: 'clamp(60px,9vw,120px)' }}>
        <div>
          <h2>{k.h2}</h2>
          <p className="sub" style={{ marginBottom: 26 }}>{k.lede}</p>
          <Link className="pill pill-p pill-lg" href={pathFor(locale, 'waitlist')} data-track="cta">{c.common.getApp}</Link>
          <div style={{ marginTop: 24 }}><StoreBadges locale={locale} /></div>
        </div>
      </div>
    </section>
  )
}
