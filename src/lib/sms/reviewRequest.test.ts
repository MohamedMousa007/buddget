import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SMS_REVIEW_PUSH_KINDS, SMS_SENDER_HELD_PUSH_KIND } from './pushKinds'
import { __resetSmsReviewRequests, requestSmsReview, subscribeSmsReviewRequests } from './reviewRequest'

describe('SLG-4 held-credit push opens the review sheet', () => {
  beforeEach(() => __resetSmsReviewRequests())

  it('delivers a request made before the sheet owner mounted, once', () => {
    requestSmsReview()
    const open = vi.fn()
    subscribeSmsReviewRequests(open)
    expect(open).toHaveBeenCalledTimes(1)
    subscribeSmsReviewRequests(open)
    expect(open).toHaveBeenCalledTimes(1)
  })

  it('delivers a live request and stops after unsubscribe', () => {
    const open = vi.fn()
    const off = subscribeSmsReviewRequests(open)
    requestSmsReview()
    expect(open).toHaveBeenCalledTimes(1)
    off()
    requestSmsReview()
    expect(open).toHaveBeenCalledTimes(1)
  })

  it('both the held-sender kind and the generic confirm kind route to review', () => {
    expect(SMS_REVIEW_PUSH_KINDS.has(SMS_SENDER_HELD_PUSH_KIND)).toBe(true)
    expect(SMS_REVIEW_PUSH_KINDS.has('sms_confirm')).toBe(true)
    expect(SMS_REVIEW_PUSH_KINDS.has('sms_auto_added')).toBe(false)
  })

  it('the tap handler never posts to /api/sms/confirm', () => {
    const shell = readFileSync('src/components/layout/AppShell.tsx', 'utf8')
    expect(shell).not.toContain('/api/sms/confirm')
    expect(shell).toContain('requestSmsReview()')
  })

  it('the parse route gives a held credit its own push kind and failure code', () => {
    const route = readFileSync('src/app/api/sms/parse/route.ts', 'utf8')
    expect(route).toMatch(/if \(senderHeld\) \{\s+pushArgs = \{[\s\S]*?SMS_SENDER_HELD_PUSH_KIND/)
    expect(route).toContain("failure_code: senderHeld ? 'sender_mismatch'")
  })
})
