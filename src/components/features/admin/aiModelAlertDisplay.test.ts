import { describe, expect, it } from 'vitest'
import { aiModelAlertLines, type AiModelAlert } from './aiModelAlertDisplay'

const alert = (o: Partial<AiModelAlert>): AiModelAlert => ({ alert_date: '2026-11-20', model: 'm', calls: 12, errors: 4, empties: 0, failed_share: 0.3333, rule: 'share', ...o })

describe('aiModelAlertLines', () => {
  it('words the share rule with counts and a whole percent', () => {
    expect(aiModelAlertLines([alert({ model: 'quick', errors: 3, empties: 1 })])).toEqual(['Buddgy model quick: 4 of 12 chat calls failed (33%) in the 24 hours before 2026-11-20'])
  })

  it('words the all-failed rule', () => {
    expect(aiModelAlertLines([alert({ model: 'quick', calls: 3, errors: 3, failed_share: 1, rule: 'all_failed' })])).toEqual(['Buddgy model quick: all 3 chat calls failed in the 24 hours before 2026-11-20'])
  })

  it('keeps only the newest day per model, newest first', () => {
    const lines = aiModelAlertLines([
      alert({ model: 'a', alert_date: '2026-11-18' }),
      alert({ model: 'a', alert_date: '2026-11-20' }),
      alert({ model: 'b', alert_date: '2026-11-19' }),
    ])
    expect(lines).toHaveLength(2)
    expect(lines[0]).toContain('model a:')
    expect(lines[0]).toContain('2026-11-20')
    expect(lines[1]).toContain('model b:')
  })

  it('returns nothing for no alerts', () => {
    expect(aiModelAlertLines([])).toEqual([])
  })
})
