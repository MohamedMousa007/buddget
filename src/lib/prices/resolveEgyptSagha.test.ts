import { describe, it, expect } from 'vitest'
import { resolveEgyptSaghaFromHtml } from './resolveEgyptSagha'

const ctx = { ounceUsd: 4063.5, officialUsdEgp: 51.35 }

const REALEGP = '<b>متوسط السعر <span>52.41</span></b>'
const SOUQ = '<li>دولار الصاغة <strong>52.46</strong></li>'
const DOLLAREGYPT = '<td>عيار 21</td><td>5,960</td>'

describe('resolveEgyptSaghaFromHtml', () => {
  it('clusters three independent sources into a high-confidence Sagha dollar', () => {
    const r = resolveEgyptSaghaFromHtml(
      { realegp: REALEGP, 'souq-price-today': SOUQ, dollaregypt: DOLLAREGYPT },
      ctx,
    )
    expect(r.confidence).toBe('high')
    expect(r.upstreams).toBe(3)
    expect(r.value).toBeGreaterThan(52)
    expect(r.value).toBeLessThan(53)
  })

  it('drops a spot-derived (official-rate) outlier via the sanity band', () => {
    // A source returning the OFFICIAL rate (51.35) as if it were the Sagha number would drag the
    // consensus toward spot — it must be excluded, not averaged in. Here we feed a source whose
    // implied value sits below the band and confirm the two real sources still win.
    const belowBand = '<b>متوسط السعر <span>40.00</span></b>' // 40/51.35 = 0.78 < 0.95 floor
    const r = resolveEgyptSaghaFromHtml(
      { realegp: belowBand, 'souq-price-today': SOUQ, dollaregypt: DOLLAREGYPT },
      ctx,
    )
    expect(r.sources).not.toContain('realegp')
    expect(r.value).toBeGreaterThan(52)
  })

  it('unavailable when every source is missing or unparseable', () => {
    const r = resolveEgyptSaghaFromHtml({ realegp: '<div>no data</div>' }, ctx)
    expect(r.confidence).toBe('unavailable')
    expect(r.value).toBeNull()
  })
})
