'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { SiteLocale } from '@/lib/site/config'
import { pathFor, siteContent } from '@/lib/site/routes'
import { CardAcc, CardBud, CardInst, CardRep, CardSubs } from './AppCards'

const CHECK = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
)

/** Feature tabs. Each panel shows a built replica of the screen, then links to the full feature page. */
export function HomeInside({ locale }: { locale: SiteLocale }) {
  const f = siteContent[locale].landing.inside
  const [i, setI] = useState(0)

  function onKey(e: React.KeyboardEvent, idx: number) {
    const rtl = locale === 'ar'
    const fwd = e.key === (rtl ? 'ArrowLeft' : 'ArrowRight')
    const back = e.key === (rtl ? 'ArrowRight' : 'ArrowLeft')
    if (!fwd && !back) return
    e.preventDefault()
    const next = (idx + (fwd ? 1 : -1) + f.tabs.length) % f.tabs.length
    setI(next)
    document.getElementById(`hm-ft-${next}`)?.focus()
  }

  const card = (k: (typeof f.tabs)[number]['key']) => (k === 'acc' ? <CardAcc locale={locale} /> : k === 'sub' ? <CardSubs locale={locale} /> : k === 'inst' ? <CardInst locale={locale} /> : k === 'rep' ? <CardRep locale={locale} /> : <CardBud locale={locale} />)

  return (
    <section className="inside sec" id="inside">
      <div className="wrap">
        <h2 className="h2">{f.h2}</h2>
        <p className="sub">{f.p}</p>
        <div className="ftabs" role="tablist">
          {f.tabs.map((t, idx) => (
            <button key={t.key} id={`hm-ft-${idx}`} type="button" role="tab" aria-selected={i === idx} aria-controls={`hm-fp-${idx}`} tabIndex={i === idx ? 0 : -1} onClick={() => setI(idx)} onKeyDown={(e) => onKey(e, idx)}>{t.name}</button>
          ))}
        </div>
        {f.tabs.map((t, idx) => (
          <div key={t.key} id={`hm-fp-${idx}`} role="tabpanel" aria-labelledby={`hm-ft-${idx}`} hidden={i !== idx} className="fpanel">
            <div>
              <h3>{t.h}</h3>
              <p>{t.p}</p>
              <ul>{t.bullets.map((b) => <li key={b}>{CHECK}<span>{b}</span></li>)}</ul>
              <p style={{ marginTop: 18 }}><Link className="lnk" href={pathFor(locale, t.slug)}>{f.learn} <span aria-hidden>{locale === 'ar' ? '←' : '→'}</span></Link></p>
            </div>
            <div className="shots">{card(t.key)}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
