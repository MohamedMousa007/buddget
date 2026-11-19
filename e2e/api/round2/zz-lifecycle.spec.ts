// S8c round 2, runs last (file order): deletes synthetic user C, then replays C's still-unexpired JWT (QA-53).
// Recreate C with setup.mjs before the next run.
import { test, expect } from '@playwright/test'
import { USERS, serviceDelete, serviceGet, signIn } from './lib'

const auth = (t: string) => ({ Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' })

let C = ''
test.describe.configure({ mode: 'serial' })

test('QA-53: a deleted account cannot create feedback, support, votes, tokens or trials', async ({ request }) => {
  C = await signIn('C')
  const del = await request.post('/api/account/delete', { headers: auth(C), data: {} })
  expect(del.status()).toBe(200)
  const again = await request.post('/api/account/delete', { headers: auth(C), data: {} })
  expect(again.status()).toBeLessThan(500)
  expect((await serviceGet(`profiles?id=eq.${USERS.C.id}&select=id&limit=1`)).json).toEqual([])

  const writes: Array<[string, unknown]> = [
    ['/api/feedback', { message: 'qa s8c', kind: 'bug' }],
    ['/api/support/board/1/vote', { vote: true }],
    ['/api/billing/paywall-view', { platform: 'web', source: 'qa-s8c' }],
    ['/api/sms/setup-token', {}],
    ['/api/entitlements/trial', {}],
  ]
  for (const [path, data] of writes) {
    expect((await request.post(path, { headers: auth(C), data })).status(), path).toBe(401)
  }
  // Reads stay on the local JWT check by decision (QA-53, section 7); they must not error.
  for (const path of ['/api/notifications', '/api/entitlements/me', '/api/flags']) {
    expect((await request.get(path, { headers: auth(C) })).status(), path).toBeLessThan(500)
  }
})

test('S8C-05: support/submit from a deleted account answers 4xx and stores nothing', async ({ request }) => {
  test.fail(true, 'S8C-05: resolveApiUserId accepts the deleted JWT; support_submit then hits support_tickets_user_id_fkey and the route answers 500')
  const sup = await request.post('/api/support/submit', { headers: auth(C), data: { chosen: 'question', title: 'qa s8c deleted account' } })
  const orphan = (await serviceGet(`support_tickets?user_id=eq.${USERS.C.id}&select=number&limit=5`)).json as Array<{ number: number }>
  if (orphan.length) await serviceDelete(`support_tickets?user_id=eq.${USERS.C.id}`)
  expect(orphan).toEqual([])
  expect(sup.status()).toBeLessThan(500)
})
