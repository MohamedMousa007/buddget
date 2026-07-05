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
}

const MAX_JOBS = 20

interface PendingAiJobsState {
  jobs: PendingAiJob[]
  /** Returns false when the queue is full (caller shows the plain offline error). */
  addJob: (job: PendingAiJob) => boolean
  removeJob: (id: string) => void
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
