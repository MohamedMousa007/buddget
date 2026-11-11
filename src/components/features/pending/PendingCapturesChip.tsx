'use client'

import { useEffect, useState } from 'react'
import { Loader2, CloudUpload, WifiOff, X } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import {
  usePendingAiJobs,
  readPendingMedia,
  deletePendingMedia,
  isRetryableStatus,
} from '@/lib/store/usePendingAiJobs'
import { ReceiptScanSheet } from '@/components/receipt/ReceiptScanSheet'
import { IconButton } from '@/components/ui/IconButton'
import { SelectableCard } from '@/components/ui/SelectableCard'

class TranscribeError extends Error {
  constructor(readonly status: number) {
    super(`transcribe failed (${status})`)
  }
}

/**
 * Surfaces offline voice/receipt captures queued by the capture-now-process-
 * later flow. Tapping processes the oldest job through the normal review
 * surface — receipts re-open the scan sheet seeded with the stored photo,
 * voice notes are transcribed and handed to the AI chat for confirmation.
 * Nothing is ever auto-inserted without review.
 */
export function PendingCapturesChip() {
  const t = useT()
  const jobs = usePendingAiJobs((s) => s.jobs)
  const removeJob = usePendingAiJobs((s) => s.removeJob)
  const failJob = usePendingAiJobs((s) => s.failJob)
  const pruneExpired = usePendingAiJobs((s) => s.pruneExpired)
  const { online } = useNetworkStatus()
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [reviewJob, setReviewJob] = useState<{
    jobId: string
    dataUrl: string
  } | null>(null)
  const openAiChatWithSeed = useSettingsStore((s) => s.openAiChatWithSeed)

  useEffect(() => {
    for (const id of pruneExpired()) void deletePendingMedia(id)
  }, [pruneExpired])

  if (jobs.length === 0) return null

  const finishJob = (id: string) => {
    removeJob(id)
    void deletePendingMedia(id)
  }

  const processNext = async () => {
    if (busy || !online) return
    const job = jobs[0]
    setBusy(true)
    setNotice(null)
    try {
      const media = await readPendingMedia(job.id)
      if (!media) {
        // Media file is gone (cleared storage) — drop the orphaned job.
        removeJob(job.id)
        return
      }
      if (job.kind === 'receipt') {
        setReviewJob({
          jobId: job.id,
          dataUrl: `data:${job.mimeType};base64,${media}`,
        })
        return
      }
      const { apiFetchAuth } = await import('@/lib/apiBase')
      const language = useFinanceStore.getState().settings.language === 'ar' ? 'ar' : 'en'
      const res = await apiFetchAuth('/api/voice/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audio: media,
          mimeType: job.mimeType,
          language,
        }),
      })
      if (!res.ok) throw new TranscribeError(res.status)
      const data = (await res.json()) as { text?: string }
      const text = data.text?.trim()
      if (text) {
        finishJob(job.id)
        // Confirmation happens in the AI chat — same flow as a live voice note.
        openAiChatWithSeed(text)
      } else {
        // Transcription succeeded but heard nothing — retrying won't change
        // that, so drop the job and tell the user honestly.
        finishJob(job.id)
        setNotice(t.pendingCaptures.voiceEmpty)
      }
    } catch (e) {
      // Only a permanent 4xx (bad audio, 413) can never succeed; auth and quota keep the job paused.
      const status = e instanceof TranscribeError ? e.status : 0
      const retryable = isRetryableStatus(status)
      const dropped = failJob(job.id, retryable, status >= 500) === 'dropped'
      if (dropped) void deletePendingMedia(job.id)
      setNotice(dropped && retryable ? t.pendingCaptures.gaveUp : t.pendingCaptures.failed)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="mx-4 mt-3 flex items-center gap-1">
        <SelectableCard
          as="action"
          surface="card"
          onClick={() => void processNext()}
          disabled={busy || !online}
          className="min-h-11 min-w-0 flex-1 gap-2.5 px-4 py-2.5 disabled:opacity-80"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[var(--color-brand-green)]" />
          ) : online ? (
            <CloudUpload className="h-4 w-4 shrink-0 text-[var(--color-brand-green)]" />
          ) : (
            <WifiOff className="h-4 w-4 shrink-0 text-[var(--color-brand-text-muted)]" />
          )}
          <span className="flex-1 text-xs text-[var(--color-brand-text-secondary)]">
            {notice ??
              (online
                ? t.pendingCaptures.chip(jobs.length)
                : t.pendingCaptures.waitingOffline(jobs.length))}
          </span>
        </SelectableCard>
        <IconButton aria-label={t.pendingCaptures.dismiss} onClick={() => finishJob(jobs[0].id)}>
          <X />
        </IconButton>
      </div>

      <ReceiptScanSheet
        open={reviewJob !== null}
        seed={reviewJob}
        onConfirmed={() => reviewJob && finishJob(reviewJob.jobId)}
        onClose={() => setReviewJob(null)}
      />
    </>
  )
}
