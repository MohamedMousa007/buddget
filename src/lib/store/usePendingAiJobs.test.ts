/**
 * Tests for the offline AI capture queue (metadata store).
 * Media I/O is native-only (Capacitor Filesystem) and exercised on-device.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/lib/native/isNative', () => ({ isNative: () => false }))

import { usePendingAiJobs, isRetryableStatus, type PendingAiJob } from '@/lib/store/usePendingAiJobs'

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
  describe('failJob (head-of-line blocking)', () => {
    it('rotates a retryable failure to the back of the queue', () => {
      const { addJob, failJob } = usePendingAiJobs.getState()
      addJob(job('a'))
      addJob(job('b'))
      expect(failJob('a', true)).toBe('requeued')
      expect(usePendingAiJobs.getState().jobs.map((j) => j.id)).toEqual(['b', 'a'])
      expect(usePendingAiJobs.getState().jobs[1].attempts).toBe(1)
    })

    it('never drops a retryable job however often it fails', () => {
      const { addJob, failJob } = usePendingAiJobs.getState()
      addJob(job('a'))
      for (let i = 0; i < 6; i++) expect(failJob('a', true)).toBe('requeued')
      expect(usePendingAiJobs.getState().jobs).toHaveLength(1)
    })

    it('keeps the media on auth, quota and server failures, drops only permanent 4xx', () => {
      for (const s of [0, 401, 403, 429, 500, 503]) expect(isRetryableStatus(s)).toBe(true)
      for (const s of [400, 413, 422]) expect(isRetryableStatus(s)).toBe(false)
    })

    it('drops immediately on a non-retryable failure', () => {
      const { addJob, failJob } = usePendingAiJobs.getState()
      addJob(job('a'))
      addJob(job('b'))
      expect(failJob('a', false)).toBe('dropped')
      expect(usePendingAiJobs.getState().jobs.map((j) => j.id)).toEqual(['b'])
    })
  })

  it('pruneExpired removes jobs older than the TTL and returns their ids', () => {
    const { addJob, pruneExpired } = usePendingAiJobs.getState()
    const old = new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString()
    addJob({ ...job('old'), createdAt: old })
    addJob(job('fresh'))
    expect(pruneExpired()).toEqual(['old'])
    expect(usePendingAiJobs.getState().jobs.map((j) => j.id)).toEqual(['fresh'])
  })
})
