import { describe, expect, it, vi } from 'vitest'
import { buildIssue, createLinearIssue, linearConfig, type IssuePayload } from './linear'

const payload: IssuePayload = { number: 42, kind: 'bug', area: 'sms', severity: 'high', subject: 'Messages stopped importing', platform: 'ios', version: '1.4.0' }
const cfg = linearConfig({})

describe('buildIssue', () => {
  it('carries the ticket number and the engineering facts, and nothing about the person', () => {
    const issue = buildIssue(payload, cfg)
    expect(issue.title).toBe('[#42] Messages stopped importing')
    expect(issue.description).toContain('Platform: ios')
    expect(issue.description).toContain('App version: 1.4.0')
    expect(JSON.stringify(issue)).not.toMatch(/@|email/i)
  })
  it('maps severity to Linear priority and kind to a label', () => {
    expect(buildIssue({ ...payload, severity: 'critical' }, cfg).priority).toBe(1)
    expect(buildIssue({ ...payload, severity: 'low' }, cfg).priority).toBe(4)
    expect(buildIssue(payload, cfg).labelIds).toContain(cfg.labelBug)
    expect(buildIssue({ ...payload, kind: 'feature' }, cfg).labelIds).toContain(cfg.labelFeature)
  })
  it('leaves out facts it does not have and caps the title', () => {
    const issue = buildIssue({ ...payload, area: null, platform: null, version: null, subject: 'x'.repeat(400) }, cfg)
    expect(issue.description).not.toContain('Area:')
    expect(issue.title.length).toBe(200)
  })
})

describe('createLinearIssue', () => {
  const input = buildIssue(payload, cfg)
  const reply = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch
  it('returns the issue it created', async () => {
    const r = await createLinearIssue('key', input, reply({ data: { issueCreate: { success: true, issue: { id: 'i1', identifier: 'BUD-9', url: 'https://linear.app/x/BUD-9' } } } }))
    expect(r).toEqual({ ok: true, id: 'i1', identifier: 'BUD-9', url: 'https://linear.app/x/BUD-9' })
  })
  it('reports failures instead of throwing', async () => {
    expect(await createLinearIssue('key', input, reply({}, 500))).toMatchObject({ ok: false })
    expect(await createLinearIssue('key', input, reply({ data: { issueCreate: { success: false } } }))).toMatchObject({ ok: false })
    const boom = vi.fn(async () => { throw new Error('offline') }) as unknown as typeof fetch
    expect(await createLinearIssue('key', input, boom)).toMatchObject({ ok: false, error: 'offline' })
  })
})
