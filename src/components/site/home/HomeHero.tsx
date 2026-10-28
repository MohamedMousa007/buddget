'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { WEB_APP_URL, type SiteLocale } from '@/lib/site/config'
import { pathFor, siteContent } from '@/lib/site/routes'
import type { DemoCat } from '@/lib/site/content/types'
import { BuddgyFace, type FaceMood } from './BuddgyFace'
import { fill, nf } from './format'

const BUDGET = 687
const R = 200
const C = 2 * Math.PI * R
const GAP = 3
const COL: Record<DemoCat, string> = { food: '#E5684D', transport: '#389BD9', groceries: '#8B5CF6', fun: '#F0BE5B' }

type Spend = { a: number; cat: DemoCat; label: string }

function Ticks() {
  return (
    <>
      {Array.from({ length: 60 }, (_, i) => {
        const a = (i / 60) * Math.PI * 2
        const lg = i % 5 === 0
        const r2 = lg ? 252 : 245
        return <line key={i} x1={(260 + Math.sin(a) * 236).toFixed(1)} y1={(260 - Math.cos(a) * 236).toFixed(1)} x2={(260 + Math.sin(a) * r2).toFixed(1)} y2={(260 - Math.cos(a) * r2).toFixed(1)} className={lg ? 'tk lg' : 'tk'} strokeWidth={lg ? 3 : 2} strokeLinecap="round" />
      })}
    </>
  )
}

function arcProps(len: number, start: number) {
  return { strokeDasharray: `${Math.max(0, len - GAP).toFixed(1)} ${C.toFixed(1)}`, strokeDashoffset: (-start).toFixed(1) }
}

export function smsNode(template: string, a: string, m: string) {
  return template.split(/(\{a\}|\{m\})/).map((part, i) => (part === '{a}' ? <mark key={i}>{a}</mark> : part === '{m}' ? <mark key={i}>{m}</mark> : <span key={i}>{part}</span>))
}

/** Hero: the Day Ring. Tap an item and the day's number, the arcs, Buddgy and the bank text all react. */
export function HomeHero({ locale }: { locale: SiteLocale }) {
  const c = siteContent[locale]
  const h = c.landing.hero
  const [spends, setSpends] = useState<Spend[]>([])
  const [say, setSay] = useState(h.say0)
  const [shown, setShown] = useState(BUDGET)
  const tween = useRef(0)
  const shownRef = useRef(BUDGET)

  const spent = spends.reduce((s, x) => s + x.a, 0)
  const left = BUDGET - spent

  useEffect(() => {
    cancelAnimationFrame(tween.current)
    const dur = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 700
    const from = shownRef.current
    const t0 = performance.now()
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / dur)
      const v = from + (left - from) * (1 - Math.pow(1 - k, 3))
      shownRef.current = v
      setShown(v)
      if (k < 1) tween.current = requestAnimationFrame(step)
    }
    tween.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(tween.current)
  }, [left])

  const arcs = useMemo(() => {
    const out: { len: number; start: number; color: string }[] = []
    for (const s of spends) {
      const start = out.reduce((sum, a) => sum + Math.max(0, a.len), 0)
      out.push({ len: Math.min((s.a / BUDGET) * C, C - start), start, color: COL[s.cat] })
    }
    return out
  }, [spends])
  const used = arcs.reduce((s, a) => s + Math.max(0, a.len), 0)
  const rem = Math.max(0, C - used)
  const tone = left < 0 ? 'over' : left < BUDGET * 0.25 ? 'low' : ''
  const remColor = left < 0 ? '#E5684D' : left < BUDGET * 0.25 ? '#F0BE5B' : '#1FC3B2'
  const mood: FaceMood = spends.length === 0 ? 'awake' : left < 0 ? 'alert' : left < BUDGET * 0.25 ? 'worried' : left < BUDGET * 0.6 ? 'curious' : 'happy'

  function spend(i: number) {
    const chip = h.chips[i]
    const next = [...spends, { a: chip.amount, cat: chip.cat, label: chip.label }]
    const l = BUDGET - next.reduce((s, x) => s + x.a, 0)
    setSpends(next)
    setSay(l < 0 ? fill(h.sayOver, { n: nf(-l) }) : l < BUDGET * 0.25 ? h.sayLow : h.sayOk[next.length % h.sayOk.length])
  }

  function reset() {
    setSpends([])
    setSay(h.sayReset)
  }

  const last = spends[spends.length - 1]
  const display = `${shown < -0.5 ? '−' : ''}${nf(Math.abs(shown))}`

  return (
    <section className="hero" aria-labelledby="home-h1">
      <div className="wrap hero-grid">
        <div>
          <h1 className="h1" id="home-h1">{h.h1}</h1>
          <p className="lede">{h.lede}</p>
          <div className="cta-row">
            <Link className="pill pill-p pill-lg" href={pathFor(locale, 'download')} data-track="cta">{c.common.getApp}</Link>
            <a className="pill pill-g pill-lg" href={WEB_APP_URL} data-track="cta">{c.common.tryBrowser}</a>
          </div>
          <ul className="assure">
            {h.assure.map((a) => (
              <li key={a}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                {a}
              </li>
            ))}
          </ul>
          <p className="fine">{c.common.haveAccount} <a href={WEB_APP_URL} data-track="cta">{c.common.logIn}</a></p>
        </div>
        <div className="stage">
          <div className="ring-wrap">
            <svg viewBox="0 0 520 520" aria-hidden="true">
              <Ticks />
              <circle cx="260" cy="260" r={R} className="track" strokeWidth="30" />
              <g transform="rotate(-90 260 260)">
                {arcs.map((a, i) => a.len > 0 ? <circle key={i} className="arc" cx="260" cy="260" r={R} stroke={a.color} {...arcProps(a.len, a.start)} /> : null)}
                {rem > GAP ? <circle className={`arc rem ${tone}`} cx="260" cy="260" r={R} stroke={remColor} {...arcProps(rem, used)} /> : null}
              </g>
            </svg>
            <div className="core" aria-live="polite" aria-atomic="true">
              <small>{h.leftToday}</small>
              <span className={`big num ${tone}`}>{display}</span>
              <span className="unit">{h.unit}</span>
            </div>
            <div className="bud">
              <div><BuddgyFace mood={mood} size={84} /></div>
              <div className="say">{say}</div>
            </div>
            <a className="coin-cta" href={WEB_APP_URL} data-track="cta" aria-label={c.common.tryBrowser}>
              <svg viewBox="0 0 132 132" aria-hidden="true">
                <defs><path id="hm-circ" d="M66,66 m-48,0 a48,48 0 1,1 96,0 a48,48 0 1,1 -96,0" /></defs>
                <circle cx="66" cy="66" r="64" fill="#1FC3B2" />
                <g className="spin"><text fontFamily="var(--f-sans)" fontSize={locale === 'ar' ? 13 : 12.5} fontWeight="700" letterSpacing={locale === 'ar' ? 0 : 2.2} fill="#04201C"><textPath href="#hm-circ" startOffset={locale === 'ar' ? '100%' : '0%'}>{h.coin}</textPath></text></g>
                <circle cx="66" cy="66" r="25" fill="#04201C" />
                <path d="M58 74 L74 58 M62 58 H74 V70" fill="none" stroke="#1FC3B2" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          </div>
          <div className="feed" aria-live="polite">
            {last ? (
              <div className="sms" key={spends.length}>
                <b><span>CIB</span><span>{h.ago}</span></b>
                {smsNode(h.sms, last.a.toFixed(2), last.label.toUpperCase())}
                <br />
                <i style={{ background: COL[last.cat] }}>{h.cat[last.cat]} · −{last.a}</i>
              </div>
            ) : null}
          </div>
          <div className="dock">
            <p className="dock-note">{h.hint}</p>
            {h.chips.map((chip, i) => (
              <button key={chip.label} type="button" className="chip" onClick={() => spend(i)}>
                <i style={{ background: COL[chip.cat] }} aria-hidden />{chip.label} <span className="num">{chip.amount}</span>
              </button>
            ))}
          </div>
          <p className="nudge">
            {spends.length >= 2 ? (
              <>
                {h.nudge} <a href={WEB_APP_URL} data-track="cta">{h.nudgeCta}</a>{' '}
                <button type="button" className="reset" onClick={reset}>{h.again}</button>
              </>
            ) : null}
          </p>
        </div>
      </div>
    </section>
  )
}
