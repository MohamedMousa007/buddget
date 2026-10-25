import { describe, expect, it } from 'vitest'
import { ADMIN_NAV } from '../nav'
import { ADMIN_SEARCH_INDEX, buildAdminSearchIndex, searchAdmin } from './index'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('admin search index', () => {
  it('has a page entry for every navigation item', () => {
    const pages = ADMIN_SEARCH_INDEX.filter((e) => e.group === 'Pages').map((e) => e.section)
    expect(pages).toEqual(ADMIN_NAV.flatMap((g) => g.items.map((i) => i.section)))
  })

  it('every entry points at a section the router registers, with unique ids', () => {
    const app = readFileSync(resolve(__dirname, '../../../components/features/admin/AdminApp.tsx'), 'utf8')
    const registered = [...app.matchAll(/^\s+'?([a-z-]+)'?: \(\) => import\(/gm)].map((m) => m[1])
    for (const e of ADMIN_SEARCH_INDEX) expect(registered).toContain(e.section)
    expect(new Set(ADMIN_SEARCH_INDEX.map((e) => e.id)).size).toBe(ADMIN_SEARCH_INDEX.length)
  })

  it('drops sub-entries whose section is not in the navigation', () => {
    const idx = buildAdminSearchIndex(ADMIN_NAV, [{ section: 'nope', title: 'X', group: 'Settings', description: '', keywords: [] }])
    expect(idx.some((e) => e.title === 'X')).toBe(false)
  })

  it('only returns destinations the role may open', () => {
    const none = searchAdmin('users', new Set())
    expect(none.flatMap((g) => g.entries).map((e) => e.section)).not.toContain('users')
    const support = new Set(['support.view'])
    expect(searchAdmin('tickets', support)[0].entries[0].section).toBe('support')
    expect(searchAdmin('create ticket', support).flatMap((g) => g.entries).some((e) => e.title === 'Create a ticket')).toBe(false)
    expect(searchAdmin('create ticket', new Set(['support.view', 'support.reply'])).flatMap((g) => g.entries).some((e) => e.title === 'Create a ticket')).toBe(true)
  })

  it('finds sub-sections by synonym and carries the deep-link params', () => {
    const hit = searchAdmin('banned', new Set(['*']))[0].entries[0]
    expect(hit.section).toBe('users')
    expect(hit.params).toEqual({ state: 'banned' })
    expect(searchAdmin('send log', new Set(['*']))[0].entries[0].params).toEqual({ tab: 'log' })
  })

  it('an empty query lists the pages in nav order', () => {
    const res = searchAdmin('', new Set(['*']))
    expect(res).toHaveLength(1)
    expect(res[0].group).toBe('Pages')
  })
})
