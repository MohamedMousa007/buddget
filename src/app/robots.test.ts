import { describe, it, expect } from 'vitest'
import robots from './robots'

describe('robots.txt', () => {
  const rule = [robots().rules].flat()[0]

  it('lets crawlers fetch what the website pages load', () => {
    for (const p of ['/_next/', '/site/', '/icons/', '/og-']) expect(rule.allow).toContain(p)
  })

  it('keeps everything else closed', () => {
    expect(rule.disallow).toBe('/')
  })
})
