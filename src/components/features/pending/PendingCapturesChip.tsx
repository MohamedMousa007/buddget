'use client'

import { useState } from 'react'
import { Loader2, CloudUpload, WifiOff } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { usePendingAiJobs, readPendingMedia, deletePendingMedia } from '@/lib/store/usePendingAiJobs'
import { ReceiptScanSheet } from '@/components/receipt/ReceiptScanSheet'

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
  const { online } = useNetworkStatus()
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [reviewJob, setReviewJob] = useState<{ jobId: string; dataUrl: string } | null>(null)
  const openAiChatWithSeed = useSettingsStore((s) => s.openAiChatWithSeed)

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
        setReviewJob({ jobId: job.id, dataUrl: `data:${job.mimeType};base64,${media}` })
        return
      }
      const { apiFetchAuth } = await import('@/lib/apiBase')
      const language = useFinanceStore.getState().settings.language === 'ar' ? 'ar' : 'en'
      const res = await apiFetchAuth('/api/voice/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio: media, mimeType: job.mimeType, language }),
      })
      if (!res.ok) throw new Error(`transcribe failed (${res.status})`)
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
    } catch {
      setNotice(t.pendingCaptures.failed)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void processNext()}
        disabled={busy || !online}
        className="mx-4 mt-3 flex min-h-[44px] w-[calc(100%-2rem)] items-center gap-2.5 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-4 py-2.5 text-start disabled:opacity-80"
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
      </button>

      <ReceiptScanSheet
        open={reviewJob !== null}
        seed={reviewJob}
        onConfirmed={() => reviewJob && finishJob(reviewJob.jobId)}
        onClose={() => setReviewJob(null)}
      />
    </>
  )
}
