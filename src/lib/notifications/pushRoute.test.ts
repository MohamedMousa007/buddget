import { describe, expect, it } from 'vitest'
import { routeForNotifType } from '@/lib/notifications/pushRoute'

describe('NAT-4 cron push tap routes', () => {
  it.each(['recurring_due', 'recurring_tomorrow', 'subscription_digest', 'subscription_trial', 'subscription_price', 'goal_behind', 'goal_milestone', 'goal_achieved', 'savings_carry'])('%s opens a screen', (t) => {
    expect(routeForNotifType(t)).toMatch(/^\//)
  })
  it('unknown or missing types open nothing', () => {
    expect(routeForNotifType('nope')).toBeNull()
    expect(routeForNotifType(undefined)).toBeNull()
  })
})
