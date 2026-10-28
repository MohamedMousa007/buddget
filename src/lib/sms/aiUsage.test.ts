import { describe, expect, it } from 'vitest'
import { aiCallsToday } from './aiUsage'

const db = (views: Record<string, { data: Record<string, number> | null; error: unknown }>) => ({
  from: (v: string) => ({ select: () => ({ eq: () => ({ maybeSingle: async () => views[v] ?? { data: null, error: { message: 'missing' } } }) }) }),
})

describe('aiCallsToday', () => {
  it('reads the AI view', async () => {
    expect(await aiCallsToday(db({ sms_ai_today: { data: { ai_count_today: 7 }, error: null } }), 'u')).toBe(7)
  })
  it('is 0 when the user has no rows today', async () => {
    expect(await aiCallsToday(db({ sms_ai_today: { data: null, error: null } }), 'u')).toBe(0)
  })
  it('falls back to the parsed view before the migration', async () => {
    expect(await aiCallsToday(db({ sms_parse_today: { data: { parsed_count_today: 3 }, error: null } }), 'u')).toBe(3)
  })
})
