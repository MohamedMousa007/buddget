import { describe, expect, it } from 'vitest'
import { tooLargeByHeader } from './bodyLimit'

const req = (headers: Record<string, string>) => new Request('http://x', { method: 'POST', headers, body: '{}' })

describe('tooLargeByHeader', () => {
  it('answers 413 when content-length is over the cap', () => {
    expect(tooLargeByHeader(req({ 'content-length': '101' }), 100)?.status).toBe(413)
  })
  it('lets a body at the cap, or one with no usable length, through for the post-read check', () => {
    expect(tooLargeByHeader(req({ 'content-length': '100' }), 100)).toBeNull()
    expect(tooLargeByHeader(req({}), 100)).toBeNull()
    expect(tooLargeByHeader(req({ 'content-length': 'abc' }), 100)).toBeNull()
  })
})
