/**
 * Tests for the offline AI capture queue (metadata store).
 * Media I/O is native-only (Capacitor Filesystem) and exercised on-device.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/lib/native/isNative', () => ({ isNative: () => false }))

import { usePendingAiJobs, type PendingAiJob } from '@/lib/store/usePendingAiJobs'

function job(id: string, kind: PendingAiJob['kind'] = 'voice'): PendingAiJob {
  return { id, kind, mimeType: 'audio/mp4', createdAt: new Date().toISOString() }
}

beforeEach(() => {
  usePendingAiJobs.setState({ jobs: [] })
})

describe('usePendingAiJobs', () => {
  it('adds and removes jobs in order', () => {
    const { addJob, removeJob } = usePendingAiJobs.getState()
    expect(addJob(job('a'))).toBe(true)
    expect(addJob(job('b', 'receipt'))).toBe(true)
    expect(usePendingAiJobs.getState().jobs.map((j) => j.id)).toEqual(['a', 'b'])
    removeJob('a')
    expect(usePendingAiJobs.getState().jobs.map((j) => j.id)).toEqual(['b'])
  })

  it('rejects new jobs once the cap is reached', () => {
    const { addJob } = usePendingAiJobs.getState()
    for (let i = 0; i < 20; i++) expect(addJob(job(`j${i}`))).toBe(true)
    expect(addJob(job('overflow'))).toBe(false)
    expect(usePendingAiJobs.getState().jobs).toHaveLength(20)
  })

  it('removing an unknown id is a no-op', () => {
    usePendingAiJobs.getState().addJob(job('a'))
    usePendingAiJobs.getState().removeJob('ghost')
    expect(usePendingAiJobs.getState().jobs).toHaveLength(1)
  })
})
