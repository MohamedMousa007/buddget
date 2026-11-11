'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { createSafeLocalStorage } from '@/lib/store/safeLocalStorage'
import { isNative } from '@/lib/native/isNative'

/**
 * Capture-now-process-later queue for AI features that need the network
 * (voice transcription, receipt scanning). Offline captures store their media
 * on-device (Capacitor Filesystem, pending-ai/<id>) and a metadata job here;
 * the PendingCapturesChip lets the user process each job through the normal
 * review flow once back online. Native-first: web offline shows a graceful
 * message instead (no queue).
 */

export interface PendingAiJob {
  id: string
  kind: 'voice' | 'receipt'
  mimeType: string
  createdAt: string
  attempts?: number
  /** Consecutive-or-not 5xx failures; at MAX_SERVER_FAULT_ATTEMPTS the job is dropped. */
  serverFaults?: number
}

const MAX_JOBS = 20
const JOB_TTL_MS = 7 * 24 * 3600 * 1000
/** A job that keeps hitting a server fault (5xx) is probably the payload; auth, quota and offline never count. */
export const MAX_SERVER_FAULT_ATTEMPTS = 8

interface PendingAiJobsState {
  jobs: PendingAiJob[]
  /** Returns false when the queue is full (caller shows the plain offline error). */
  addJob: (job: PendingAiJob) => boolean
  removeJob: (id: string) => void
  /** Records a failed attempt: a retryable job rotates to the back and stays until success, dismiss or TTL; a permanent failure is dropped. */
  failJob: (id: string, retryable: boolean, serverFault?: boolean) => 'requeued' | 'dropped'
  /** Drops jobs older than the TTL; returns their ids so the caller can delete the media. */
  pruneExpired: () => string[]
}

/** Whether a failed upload may be retried later. Auth (401/403) and quota (429) are paused, never fatal: the media is the only copy. */
export function isRetryableStatus(status: number): boolean {
  return status === 0 || status === 401 || status === 403 || status === 429 || status >= 500
}

export const usePendingAiJobs = create<PendingAiJobsState>()(
  persist(
    (set, get) => ({
      jobs: [],
      addJob: (job) => {
        if (get().jobs.length >= MAX_JOBS) return false
        set((s) => ({ jobs: [...s.jobs, job] }))
        return true
      },
      removeJob: (id) => set((s) => ({ jobs: s.jobs.filter((j) => j.id !== id) })),
      failJob: (id, retryable, serverFault = false) => {
        const job = get().jobs.find((j) => j.id === id)
        if (!job) return 'dropped'
        const attempts = (job.attempts ?? 0) + 1
        const exhausted = serverFault && (job.serverFaults ?? 0) + 1 >= MAX_SERVER_FAULT_ATTEMPTS
        if (!retryable || exhausted) {
          set((s) => ({ jobs: s.jobs.filter((j) => j.id !== id) }))
          return 'dropped'
        }
        set((s) => ({ jobs: [...s.jobs.filter((j) => j.id !== id), { ...job, attempts, serverFaults: serverFault ? (job.serverFaults ?? 0) + 1 : job.serverFaults }] }))
        return 'requeued'
      },
      pruneExpired: () => {
        const cutoff = Date.now() - JOB_TTL_MS
        const expired = get().jobs.filter((j) => new Date(j.createdAt).getTime() < cutoff)
        if (expired.length) {
          set((s) => ({ jobs: s.jobs.filter((j) => !expired.includes(j)) }))
        }
        return expired.map((j) => j.id)
      },
    }),
    {
      name: 'buddget-pending-ai-jobs',
      storage: createJSONStorage(() => createSafeLocalStorage()),
    },
  ),
)

// ── On-device media for queued jobs (native only) ─────────────────────────

const DIR = 'pending-ai'

async function fs() {
  const { Filesystem, Directory } = await import('@capacitor/filesystem')
  return { Filesystem, Directory }
}

/** Persists the raw base64 payload (no data: prefix) as pending-ai/<id>. */
export async function savePendingMedia(id: string, base64: string): Promise<boolean> {
  if (!isNative()) return false
  try {
    const { Filesystem, Directory } = await fs()
    await Filesystem.writeFile({
      path: `${DIR}/${id}`,
      data: base64,
      directory: Directory.Data,
      recursive: true,
    })
    return true
  } catch (e) {
    console.error('[pending-ai] save failed', e)
    return false
  }
}

export async function readPendingMedia(id: string): Promise<string | null> {
  if (!isNative()) return null
  try {
    const { Filesystem, Directory } = await fs()
    const { data } = await Filesystem.readFile({ path: `${DIR}/${id}`, directory: Directory.Data })
    return typeof data === 'string' ? data : null
  } catch {
    return null
  }
}

export async function deletePendingMedia(id: string): Promise<void> {
  if (!isNative()) return
  try {
    const { Filesystem, Directory } = await fs()
    await Filesystem.deleteFile({ path: `${DIR}/${id}`, directory: Directory.Data })
  } catch { /* already gone */ }
}

/**
 * Sign-out teardown: wipe the job list AND the media directory so a queued
 * voice note or receipt photo can never surface for the next user on a
 * shared device.
 */
export function clearPendingAiJobs(): void {
  usePendingAiJobs.setState({ jobs: [] })
  if (!isNative()) return
  void (async () => {
    try {
      const { Filesystem, Directory } = await fs()
      await Filesystem.rmdir({ path: DIR, directory: Directory.Data, recursive: true })
    } catch { /* directory never created */ }
  })()
}
