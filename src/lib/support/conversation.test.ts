import { describe, expect, it } from 'vitest'
import { applyMacroVars, isUnreadForStaff, isUnreadForUser, needsReply, nextReadMark, slaTone, staffFirstName, userFacingStatus } from './conversation'
import { attachmentPath, attachmentProblem, ownAttachments } from './attachments'
import { supportReplyPush, ticketFromPushData } from './pushCopy'

const T0 = '2026-11-24T10:00:00.000Z'
const T1 = '2026-11-24T11:00:00.000Z'

describe('unread', () => {
  it('is unread for the user when the team spoke after the last read', () => {
    expect(isUnreadForUser({ status: 'pending', last_message_at: T1, last_message_from: 'staff', user_last_read_at: T0 })).toBe(true)
    expect(isUnreadForUser({ status: 'pending', last_message_at: T1, last_message_from: 'staff', user_last_read_at: null })).toBe(true)
  })
  it('is read once the read mark reaches the last message', () => {
    expect(isUnreadForUser({ status: 'pending', last_message_at: T1, last_message_from: 'staff', user_last_read_at: T1 })).toBe(false)
  })
  it('never counts the user’s own message as unread for them', () => {
    expect(isUnreadForUser({ status: 'open', last_message_at: T1, last_message_from: 'user', user_last_read_at: null })).toBe(false)
  })
  it('mirrors for staff', () => {
    expect(isUnreadForStaff({ status: 'open', last_message_at: T1, last_message_from: 'user', staff_last_read_at: T0 })).toBe(true)
    expect(isUnreadForStaff({ status: 'open', last_message_at: T1, last_message_from: 'staff', staff_last_read_at: T0 })).toBe(false)
  })
})

describe('needsReply and status', () => {
  it('needs a reply only while open and the user spoke last', () => {
    expect(needsReply({ status: 'pending', last_message_at: T1, last_message_from: 'user' })).toBe(true)
    expect(needsReply({ status: 'resolved', last_message_at: T1, last_message_from: 'user' })).toBe(false)
    expect(needsReply({ status: 'open', last_message_at: T1, last_message_from: 'staff' })).toBe(false)
  })
  it('maps to Open / Waiting for you / Resolved', () => {
    expect(userFacingStatus({ status: 'pending', last_message_at: T1, last_message_from: 'staff' })).toBe('waiting')
    expect(userFacingStatus({ status: 'open', last_message_at: T1, last_message_from: 'user' })).toBe('open')
    expect(userFacingStatus({ status: 'resolved', last_message_at: T1, last_message_from: 'staff' })).toBe('resolved')
    expect(userFacingStatus({ status: 'closed', last_message_at: null, last_message_from: null })).toBe('closed')
  })
})

describe('nextReadMark', () => {
  it('moves to the newest returned message, not now', () => {
    expect(nextReadMark([{ created_at: T0 }, { created_at: T1 }], T0)).toBe(T1)
  })
  it('does not write when nothing is newer', () => {
    expect(nextReadMark([{ created_at: T0 }], T1)).toBeNull()
    expect(nextReadMark([], null)).toBeNull()
  })
})

describe('slaTone', () => {
  const now = Date.parse(T0)
  it('warns after 24h and breaches after 48h', () => {
    expect(slaTone(new Date(now - 3_600_000).toISOString(), now)).toBe('ok')
    expect(slaTone(new Date(now - 25 * 3_600_000).toISOString(), now)).toBe('warn')
    expect(slaTone(new Date(now - 49 * 3_600_000).toISOString(), now)).toBe('breach')
    expect(slaTone(null, now)).toBe('ok')
  })
})

describe('staffFirstName', () => {
  it('keeps only the first name and never an email', () => {
    expect(staffFirstName('Sara Hassan')).toBe('Sara')
    expect(staffFirstName('ops@buddget.app')).toBeNull()
    expect(staffFirstName('  ')).toBeNull()
    expect(staffFirstName(null)).toBeNull()
  })
})

describe('applyMacroVars', () => {
  it('fills the first name', () => {
    expect(applyMacroVars('Hi {{first_name}}, thanks!', { firstName: 'Mona Adel' })).toBe('Hi Mona, thanks!')
    expect(applyMacroVars('{{ FIRST_NAME }}', { firstName: 'Ali' })).toBe('Ali')
  })
  it('drops the placeholder cleanly when the name is unknown', () => {
    expect(applyMacroVars('Hi {{first_name}}, thanks!', { firstName: null })).toBe('Hi, thanks!')
    expect(applyMacroVars('أهلاً {{first_name}}، شكراً', { firstName: '' })).toBe('أهلاً، شكراً')
    expect(applyMacroVars('Hello {{first_name}}\nThanks', {})).toBe('Hello\nThanks')
  })
  it('leaves text without variables alone', () => {
    expect(applyMacroVars('No vars here', { firstName: 'X' })).toBe('No vars here')
  })
})

describe('attachments', () => {
  const uid = '11111111-1111-4111-8111-111111111111'
  const other = '22222222-2222-4222-8222-222222222222'
  const fid = '33333333-3333-4333-8333-333333333333'
  it('validates type and size', () => {
    expect(attachmentProblem({ type: 'image/png', size: 1000 })).toBeNull()
    expect(attachmentProblem({ type: 'application/pdf', size: 1000 })).toBe('type')
    expect(attachmentProblem({ type: 'image/jpeg', size: 6 * 1024 * 1024 })).toBe('size')
    expect(attachmentProblem({ type: 'image/jpeg', size: 0 })).toBe('size')
  })
  it('accepts only files under the sender’s own folder', () => {
    const mine = { path: attachmentPath(uid, fid, 'image/png'), mime: 'image/png', size: 10 }
    expect(ownAttachments(uid, [mine])).toEqual([mine])
    expect(ownAttachments(uid, [{ ...mine, path: attachmentPath(other, fid, 'image/png') }])).toBeNull()
    expect(ownAttachments(uid, [{ ...mine, path: `${uid}/../${other}/${fid}.png` }])).toBeNull()
    expect(ownAttachments(uid, [{ ...mine, mime: 'image/jpeg' }])).toBeNull()
    expect(ownAttachments(uid, undefined)).toEqual([])
    expect(ownAttachments(uid, Array(5).fill(mine))).toBeNull()
  })
})

describe('supportReplyPush', () => {
  it('is localized and deep-links to the ticket', () => {
    const en = supportReplyPush({ locale: 'en', staffFirstName: 'Sara', number: 42, message: 'Fixed  it\nnow' })
    expect(en.title).toBe('Sara from the buddget team replied')
    expect(en.body).toBe('Fixed it now')
    expect(en.data).toEqual({ kind: 'support_reply', ticketNumber: '42' })
    const ar = supportReplyPush({ locale: 'ar', staffFirstName: null, number: 42, message: 'تم' })
    expect(ar.title).toBe('ردّ فريق بادجت')
    expect(supportReplyPush({ locale: null, staffFirstName: null, number: 1, message: 'x' }).title).toBe('The buddget team replied')
  })
  it('round-trips the ticket from push data', () => {
    expect(ticketFromPushData(supportReplyPush({ locale: 'en', staffFirstName: null, number: 7, message: 'x' }).data)).toBe(7)
    expect(ticketFromPushData({ kind: 'support_resolved', ticketNumber: 9 })).toBe(9)
    expect(ticketFromPushData({ kind: 'sms_auto_added', ticketNumber: '7' })).toBeNull()
    expect(ticketFromPushData({ kind: 'support_reply', ticketNumber: 'abc' })).toBeNull()
    expect(ticketFromPushData(undefined)).toBeNull()
  })
})
