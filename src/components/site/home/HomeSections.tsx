import Link from 'next/link'
import { WEB_APP_URL, type SiteLocale } from '@/lib/site/config'
import { pathFor, siteContent } from '@/lib/site/routes'
import { LeadForm } from '../LeadForm'
import { StoreBadges } from '../sections'

const CHECK = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
)

const TRUST_ICON = {
  lock: <><rect x="5" y="10.5" width="14" height="10" rx="3" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" /></>,
  sms: <><path d="M4 5h16v11H9l-5 4V5z" /><path d="M8 9.5h8M8 12.5h5" /></>,
  eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" /></>,
  trash: <path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13" />,
}

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

export function HomeTrust({ locale }: { locale: SiteLocale }) {
  const t = siteContent[locale].landing.trust
  return (
    <section className="trust sec alt band" id="trust">
      <div className="wrap">
        <h2 className="h2">{t.h2}</h2>
        <div className="trust-grid">
          {t.items.map((i) => (
            <div className="tr" key={i.h}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{TRUST_ICON[i.icon]}</svg>
              <h3>{i.h}</h3>
              <p>{i.p}</p>
            </div>
          ))}
        </div>
        <p style={{ marginTop: 28 }}><Link className="lnk" href={pathFor(locale, t.link.slug)}>{t.link.label} <span aria-hidden>{locale === 'ar' ? '←' : '→'}</span></Link></p>
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
        <p className="sub">{p.p}</p>
        <div className="price-grid">
          {p.plans.map((pl) => (
            <div key={pl.name} className={`pc${pl.main ? ' main' : ''}`}>
              <h3>{pl.name}</h3>
              <div className="p">{pl.price}</div>
              <p style={{ margin: 0, color: 'var(--muted)', fontSize: 15 }}>{pl.tag}</p>
              <ul>{pl.items.map((x) => <li key={x}>{CHECK}<span>{x}</span></li>)}</ul>
              <Link className={`pill ${pl.main ? 'pill-p' : 'pill-g'}`} href={pathFor(locale, 'download')} data-track="cta">{pl.cta}</Link>
            </div>
          ))}
        </div>
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
  const d = c.download
  return (
    <section className="close" id="close">
      <div className="wrap close-grid" style={{ gridTemplateColumns: 'minmax(0,1fr)', paddingBottom: 'clamp(60px,9vw,120px)' }}>
        <div>
          <h2>{k.h2}</h2>
          <p className="sub" style={{ marginBottom: 26 }}>{k.lede}</p>
          <div className="max-w-[520px]">
            <LeadForm kind="waitlist" locale={locale} inline labels={{ email: d.emailLabel, placeholder: d.emailPlaceholder, submit: d.submit, sent: d.sent, error: d.error }} />
          </div>
          <p className="close-alt">
            <a className="lnk" href={WEB_APP_URL} data-track="cta">{c.common.tryBrowser}</a>
            <a className="lnk" href={WEB_APP_URL} data-track="cta">{c.common.logIn}</a>
          </p>
          <div style={{ marginTop: 8 }}><StoreBadges locale={locale} dark /></div>
        </div>
      </div>
    </section>
  )
}
