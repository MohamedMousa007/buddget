import { describe, expect, it } from 'vitest'
import { partitionGoals } from './partitionGoals'

const row = (id: string, status: unknown) => ({ goal: { id, status } as never })

describe('partitionGoals', () => {
  it('treats a missing status as active', () => {
    const { running, paused, achieved } = partitionGoals([row('a', null), row('b', undefined), row('c', 'active'), row('d', 'paused'), row('e', 'achieved'), row('f', 'cancelled')])
    expect(running.map((r) => (r.goal as { id: string }).id)).toEqual(['a', 'b', 'c'])
    expect(paused).toHaveLength(1)
    expect(achieved).toHaveLength(1)
  })
})
