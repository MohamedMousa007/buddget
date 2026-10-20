import { describe, expect, it, vi } from 'vitest'
import { createAnalyticsBuffer, type AnalyticsReport } from './buffer'

function setup() {
  let t = 1_000_000
  const sent: AnalyticsReport[] = []
  let ok = true
  const buf = createAnalyticsBuffer({ send: async (r) => (sent.push(structuredClone(r)), ok), now: () => t })
  return { buf, sent, tick: (s: number) => (t += s * 1000), fail: () => (ok = false), recover: () => (ok = true) }
}

describe('analytics buffer', () => {
  it('batches visible time, sessions and page visits into one report', async () => {
    const { buf, sent, tick } = setup()
    buf.startSession()
    buf.visit('/flow')
    buf.visit('/flow')
    buf.visit('/budget')
    buf.setVisible(true)
    tick(90)
    await buf.flush()
    expect(sent).toEqual([{ seconds: 90, sessions: 1, paths: { '/flow': 2, '/budget': 1 } }])
  })

  it('counts only visible time and sends nothing when there is nothing to say', async () => {
    const { buf, sent, tick } = setup()
    buf.setVisible(true)
    tick(30)
    buf.setVisible(false)
    tick(600)
    await buf.flush()
    expect(sent[0]!.seconds).toBe(30)
    await buf.flush()
    expect(sent).toHaveLength(1)
  })

  it('does not credit hours of activity to a device that slept', async () => {
    const { buf, sent, tick } = setup()
    buf.setVisible(true)
    tick(3 * 3600)
    await buf.flush()
    expect(sent[0]!.seconds).toBe(300)
  })

  it('keeps a failed report and sends it with the next one', async () => {
    const { buf, sent, tick, fail, recover } = setup()
    buf.startSession()
    buf.visit('/flow')
    buf.setVisible(true)
    tick(60)
    fail()
    await buf.flush()
    recover()
    tick(60)
    await buf.flush()
    expect(sent[1]).toEqual({ seconds: 120, sessions: 1, paths: { '/flow': 1 } })
  })

  it('caps how many distinct paths it remembers', async () => {
    const { buf, sent } = setup()
    for (let i = 0; i < 100; i++) buf.visit(`/p${i}`)
    await buf.flush()
    expect(Object.keys(sent[0]!.paths)).toHaveLength(30)
  })
})
