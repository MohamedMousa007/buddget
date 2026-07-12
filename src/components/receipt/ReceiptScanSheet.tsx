'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Camera, Check, X, Loader2, ReceiptText, RefreshCcw, Images, ImageOff } from 'lucide-react'
import Image from 'next/image'
import { useShallow } from 'zustand/react/shallow'
import { ModalShell } from '@/components/modals/ModalShell'
import { DatePickerField } from '@/components/ui/DatePickerField'
import { CurrencyField } from '@/components/ui/CurrencyField'
import { AmountField } from '@/components/ui/AmountField'
import { scanDocument, ReceiptCaptureCancelled, type CapturedImage } from '@/lib/native/cameraScanner'
import { isNative } from '@/lib/native/isNative'
import { saveReceiptImage } from '@/lib/native/receiptImages'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { isOnline } from '@/hooks/useNetworkStatus'
import { registerBackGuard } from '@/lib/navigation/backGuard'
import { newClientId } from '@/lib/store/useFinanceStore'
import { usePendingAiJobs, savePendingMedia, deletePendingMedia } from '@/lib/store/usePendingAiJobs'
import type { Currency, ExpenseCategory } from '@/lib/store/types'
import {
  normaliseReceipt,
  SUPPORTED_CURRENCIES,
  SUPPORTED_CATEGORIES,
  type ScannedReceipt,
} from '@/lib/receipt/normaliseReceipt'

type ScanState = 'idle' | 'scanning' | 'review' | 'parsing' | 'result' | 'notReceipt' | 'error' | 'queued'

const MAX_PAGES = 5

interface ReceiptScanSheetProps {
  open: boolean
  onClose: () => void
  /** Review an offline-queued capture: skips the camera and parses this image. */
  seed?: { jobId: string; dataUrl: string } | null
  /** Fired when the user confirms the parsed result (used to clear queued jobs). */
  onConfirmed?: () => void
}

/** Light impact when a scan lands or an expense saves. Native-only, best-effort. */
async function haptic() {
  if (!isNative()) return
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics')
    await Haptics.impact({ style: ImpactStyle.Light })
  } catch {
    /* haptics are cosmetic — ignore failures */
  }
}

/** Stores the photo on-device and enqueues a pending receipt job. */
async function queueReceiptCapture(dataUrl: string): Promise<boolean> {
  try {
    const id = newClientId()
    const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
    if (!(await savePendingMedia(id, base64))) return false
    const added = usePendingAiJobs.getState().addJob({
      id,
      kind: 'receipt',
      mimeType: 'image/jpeg',
      createdAt: new Date().toISOString(),
    })
    if (!added) void deletePendingMedia(id)
    return added
  } catch {
    return false
  }
}

export function ReceiptScanSheet({ open, onClose, seed, onConfirmed }: ReceiptScanSheetProps) {
  const [state, setState] = useState<ScanState>('idle')
  const [photos, setPhotos] = useState<CapturedImage[]>([])
  const [preview, setPreview] = useState<string | null>(null)
  const [result, setResult] = useState<ScannedReceipt | null>(null)
  const [error, setError] = useState<string | null>(null)
  const scanAbortRef = useRef<AbortController | null>(null)

  const { addExpense, addReceipt, paymentMethods, baseCurrency } = useFinanceStore(
    useShallow((s) => ({
      addExpense: s.addExpense,
      addReceipt: s.addReceipt,
      paymentMethods: s.paymentMethods,
      baseCurrency: s.settings.baseCurrency,
    })),
  )

  const reset = useCallback(() => {
    scanAbortRef.current?.abort()
    scanAbortRef.current = null
    setState('idle')
    setPhotos([])
    setPreview(null)
    setResult(null)
    setError(null)
  }, [])

  useEffect(() => {
    if (!open) reset()
  }, [open, reset])

  // Android hardware back closes the sheet instead of navigating underneath it
  // (matters for the PendingCapturesChip instance, which isn't activeModal-driven).
  useEffect(() => {
    if (!open) return
    return registerBackGuard(() => {
      onClose()
      return true
    })
  }, [open, onClose])

  /**
   * Runs the native document scanner (multi-page) and appends the returned pages
   * to the review grid. `existing` are the photos already captured, used to
   * decide where a cancel lands.
   */
  const runScan = useCallback(async (source: 'camera' | 'gallery', existing: CapturedImage[]) => {
    setError(null)
    setState('scanning')
    try {
      const captured = await scanDocument(source)
      void haptic()
      setPhotos(prev => [...prev, ...captured].slice(0, MAX_PAGES))
      setState('review')
    } catch (e) {
      if (e instanceof ReceiptCaptureCancelled) {
        if (existing.length > 0) setState('review')
        else if (isNative()) onClose()
        else setState('idle')
        return
      }
      setError(e instanceof Error ? e.message : 'Could not open the scanner')
      setState('error')
    }
  }, [onClose])

  /** Sends all captured photos to the API for parsing. */
  const submitPhotos = useCallback(async (capturedPhotos: CapturedImage[]) => {
    if (capturedPhotos.length === 0) return
    const ctrl = new AbortController()
    scanAbortRef.current = ctrl
    setPreview(capturedPhotos[0].dataUrl)
    setState('parsing')
    try {
      const form = new FormData()
      for (const p of capturedPhotos) form.append('image', p.file)
      const { apiFetchAuth } = await import('@/lib/apiBase')
      const res = await apiFetchAuth('/api/receipt/scan', { method: 'POST', body: form, credentials: 'include', signal: ctrl.signal })
      if (!res.ok) {
        if (res.status === 503) throw new Error('AI scanning is temporarily offline. Please set up manually or try again in a moment.')
        if (res.status === 422) throw new Error('We had trouble reading this receipt. Make sure the total and merchant are clearly visible, then try again.')
        if (res.status === 429) throw new Error('Receipt scanning limit reached. Please try again in a moment.')
        if (res.status === 401) throw new Error('Please sign in to use receipt scanning.')
        const err = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(err?.error || `Scan failed (${res.status})`)
      }
      const data = (await res.json()) as { receipt?: Record<string, unknown> | null }
      if (!data.receipt) throw new Error('We had trouble reading this receipt. Make sure the total and merchant are clearly visible, then try again.')
      if (ctrl.signal.aborted) return
      const normalised = normaliseReceipt(data.receipt, baseCurrency)
      setResult(normalised)
      setState(normalised.isReceipt ? 'result' : 'notReceipt')
    } catch (e) {
      if (ctrl.signal.aborted) return
      // Offline queue: only for single-photo native captures (multi-photo can't be stored as one job).
      if (capturedPhotos.length === 1 && !seed && isNative() && !isOnline() && (await queueReceiptCapture(capturedPhotos[0].dataUrl))) {
        setState('queued')
        return
      }
      const msg = !isOnline()
        ? "You're offline. Receipt scanning needs an internet connection — please try again once you're back online."
        : e instanceof TypeError
          ? 'Network connection lost. Please check your internet and try again.'
          : e instanceof Error
            ? e.message
            : 'Could not scan that receipt'
      setError(msg)
      setState('error')
    }
  }, [baseCurrency, seed])

  /** Handles seeded (offline-queued) review: parses the stored photo immediately. */
  const startSeedScan = useCallback(async () => {
    if (!seed) return
    setState('scanning')
    const ctrl = new AbortController()
    scanAbortRef.current = ctrl
    try {
      const blob = await fetch(seed.dataUrl).then(r => r.blob())
      if (ctrl.signal.aborted) return
      setPreview(seed.dataUrl)
      setState('parsing')
      const form = new FormData()
      form.append('image', blob)
      const { apiFetchAuth } = await import('@/lib/apiBase')
      const res = await apiFetchAuth('/api/receipt/scan', { method: 'POST', body: form, credentials: 'include', signal: ctrl.signal })
      if (!res.ok) throw new Error(`Scan failed (${res.status})`)
      const data = (await res.json()) as { receipt?: Record<string, unknown> | null }
      if (!data.receipt) throw new Error('Could not read the stored receipt image.')
      if (ctrl.signal.aborted) return
      const normalised = normaliseReceipt(data.receipt, baseCurrency)
      setResult(normalised)
      setState(normalised.isReceipt ? 'result' : 'notReceipt')
    } catch (e) {
      if (ctrl.signal.aborted) return
      setError(e instanceof Error ? e.message : 'Could not scan that receipt')
      setState('error')
    }
  }, [seed, baseCurrency])

  // ponytail: web auto-start skipped — input.click() from useEffect lacks user gesture on mobile browsers
  useEffect(() => {
    if (!open || state !== 'idle') return
    if (seed) void startSeedScan()
    else if (isNative()) void runScan('camera', [])
  }, [open, state, seed, startSeedScan, runScan])

  const confirm = () => {
    if (!result) return
    const defaultPm = paymentMethods.find((pm) => pm.isDefault) ?? paymentMethods[0]
    const paymentMethodId = defaultPm?.id ?? ''
    const date = result.date || new Date().toISOString().slice(0, 10)

    // When the scan produced a breakdown, persist it as one receipt row and link
    // the single total expense to it. No breakdown → behave exactly as before.
    const hasBreakdown = result.items.length > 0 || result.charges.length > 0
    const receiptId = hasBreakdown
      ? addReceipt({
          merchant: result.merchant || 'Scanned receipt',
          amount: result.amount,
          currency: result.currency,
          receiptDate: date,
          category: result.category,
          paymentMethodId,
          confidence: result.confidence,
          items: result.items,
          charges: result.charges,
          notes: result.notes || undefined,
        })
      : undefined

    if (receiptId && preview) void saveReceiptImage(receiptId, preview)

    addExpense({
      date,
      description: result.merchant || 'Scanned receipt',
      category: result.category,
      amount: result.amount,
      currency: result.currency,
      paymentMethodId,
      isRecurring: false,
      notes: result.notes ? `receipt: ${result.notes}` : 'receipt scan',
      ...(receiptId ? { receiptId } : {}),
    })
    void haptic()
    onConfirmed?.()
    onClose()
  }

  return (
    <ModalShell
      open={open}
      onBackdropClick={onClose}
      padContent
      panelClassName="!max-h-[min(86vh,720px)]"
    >
      {state === 'scanning' ? <Centered><Loader2 className="h-8 w-8 animate-spin text-[var(--color-brand-red)]" /><p className="text-sm text-[var(--color-brand-text-secondary)]">Opening scanner…</p></Centered> : null}

      {state === 'review' ? (
        <ReviewGrid
          photos={photos}
          onRemove={(i) => setPhotos(prev => prev.filter((_, idx) => idx !== i))}
          onAddMore={() => void runScan('camera', photos)}
          onGallery={() => void runScan('gallery', photos)}
          onAnalyze={() => void submitPhotos(photos)}
          onCancel={reset}
        />
      ) : null}

      {state === 'parsing' ? (
        <Centered>
          {preview ? (
            <Image
              src={preview}
              alt="Captured receipt"
              width={240}
              height={320}
              unoptimized
              className="h-40 w-auto rounded-xl border border-[var(--color-brand-border)] object-cover"
            />
          ) : null}
          <Loader2 className="h-6 w-6 animate-spin text-[var(--color-brand-red)]" />
          <p className="text-sm text-[var(--color-brand-text-secondary)]">Reading the receipt…</p>
        </Centered>
      ) : null}

      {state === 'queued' ? (
        <Centered>
          <Check className="h-8 w-8 text-[var(--color-brand-green)]" />
          <p className="text-sm font-medium text-[var(--color-brand-text-primary)]">Receipt captured</p>
          <p className="max-w-72 text-xs text-[var(--color-brand-text-muted)] text-center">
            You&apos;re offline right now, so we saved the photo on your device. When
            you&apos;re back online, a chip will appear at the top of the app — tap it
            to finish adding this receipt.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-2 min-h-[44px] rounded-xl bg-[var(--color-brand-red)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-brand-red-hover)]"
          >
            Done
          </button>
        </Centered>
      ) : null}

      {state === 'notReceipt' ? (
        <div className="relative">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute end-0 top-0 inline-flex h-11 w-11 items-center justify-center rounded-full text-[var(--color-brand-text-muted)] hover:bg-[var(--color-brand-elevated)]"
          >
            <X className="h-5 w-5" />
          </button>
          <Centered>
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-brand-elevated)]">
              <ImageOff className="h-7 w-7 text-[var(--color-brand-text-muted)]" />
            </div>
            <p className="text-sm font-medium text-[var(--color-brand-text-primary)]">That doesn&apos;t look like a receipt</p>
            <p className="max-w-72 text-xs text-[var(--color-brand-text-muted)] text-center">
              We couldn&apos;t find a total or merchant. Point the camera at a printed
              receipt, or pick a clearer photo.
            </p>
            <div className="mt-1 flex flex-col items-stretch gap-2">
              <button
                type="button"
                onClick={() => { reset(); void runScan('camera', []) }}
                className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-[var(--color-brand-red)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-brand-red-hover)]"
              >
                <Camera className="h-4 w-4" /> Scan again
              </button>
              <button
                type="button"
                onClick={() => { reset(); void runScan('gallery', []) }}
                className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-[var(--color-brand-border)] px-5 py-2.5 text-sm text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)]"
              >
                <Images className="h-4 w-4" /> Choose from gallery
              </button>
            </div>
          </Centered>
        </div>
      ) : null}

      {state === 'error' ? (
        <div className="relative">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute end-0 top-0 inline-flex h-11 w-11 items-center justify-center rounded-full text-[var(--color-brand-text-muted)] hover:bg-[var(--color-brand-elevated)]"
          >
            <X className="h-5 w-5" />
          </button>
          <Centered>
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-brand-elevated)]">
              <ReceiptText className="h-7 w-7 text-[var(--color-brand-text-muted)]" />
            </div>
            <p className="text-sm font-medium text-[var(--color-brand-text-primary)]">Let&apos;s try that again</p>
            <p className="max-w-72 text-xs text-[var(--color-brand-text-muted)] text-center">{error}</p>
            {photos.length > 0 ? (
              <button
                type="button"
                onClick={() => setState('review')}
                className="mt-1 inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-[var(--color-brand-red)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-brand-red-hover)]"
              >
                <RefreshCcw className="h-4 w-4" /> Back to photos
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void runScan('camera', [])}
                className="mt-1 inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-[var(--color-brand-red)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-brand-red-hover)]"
              >
                <RefreshCcw className="h-4 w-4" /> Try again
              </button>
            )}
          </Centered>
        </div>
      ) : null}

      {state === 'result' && result ? (
        <ResultView
          result={result}
          preview={preview}
          pageCount={photos.length}
          onConfirm={confirm}
          onRescan={() => {
            reset()
            if (isNative()) void runScan('camera', [])
          }}
          onCancel={onClose}
          onChange={(next) => setResult({ ...result, ...next })}
        />
      ) : null}

      {state === 'idle' ? (
        <Centered>
          <Camera className="h-8 w-8 text-[var(--color-brand-text-muted)]" />
          <p className="text-sm text-[var(--color-brand-text-secondary)]">Scan a receipt to add it as an expense.</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void runScan('camera', [])}
              className="flex min-h-[44px] items-center gap-1.5 rounded-xl bg-[var(--color-brand-red)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-brand-red-hover)]"
            >
              <Camera className="h-4 w-4" /> Scan
            </button>
            <button
              type="button"
              onClick={() => void runScan('gallery', [])}
              className="flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[var(--color-brand-border)] px-4 py-2.5 text-sm text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)]"
            >
              <Images className="h-4 w-4" /> Gallery
            </button>
          </div>
        </Centered>
      ) : null}
    </ModalShell>
  )
}

/** 2×2 grid of captured pages with per-page remove, add-more, and analyze. */
function ReviewGrid({
  photos,
  onRemove,
  onAddMore,
  onGallery,
  onAnalyze,
  onCancel,
}: {
  photos: CapturedImage[]
  onRemove: (i: number) => void
  onAddMore: () => void
  onGallery: () => void
  onAnalyze: () => void
  onCancel: () => void
}) {
  const canAddMore = photos.length < MAX_PAGES
  return (
    <div className="w-full">
      <div className="flex items-center justify-between">
        <p className="text-base font-semibold text-[var(--color-brand-text-primary)]">
          {photos.length === 1 ? 'Review your scan' : `${photos.length} pages`}
        </p>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Close"
          className="inline-flex h-11 w-11 items-center justify-center rounded-full text-[var(--color-brand-text-muted)] hover:bg-[var(--color-brand-elevated)]"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {photos.map((p, i) => (
          <div key={i} className="relative overflow-hidden rounded-xl border border-[var(--color-brand-border)]">
            <Image
              src={p.dataUrl}
              alt={`Receipt page ${i + 1}`}
              width={200}
              height={260}
              unoptimized
              className="h-36 w-full object-cover"
            />
            <button
              type="button"
              aria-label={`Remove page ${i + 1}`}
              onClick={() => onRemove(i)}
              className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 backdrop-blur-sm"
            >
              <X className="h-4 w-4 text-white" />
            </button>
          </div>
        ))}
        {canAddMore ? (
          <button
            type="button"
            onClick={onAddMore}
            className="flex h-36 flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-[var(--color-brand-border)] text-[var(--color-brand-text-muted)] hover:bg-[var(--color-brand-elevated)]"
          >
            <Camera className="h-6 w-6" />
            <span className="text-xs">Add page</span>
          </button>
        ) : null}
      </div>

      <p className="mt-3 text-xs text-[var(--color-brand-text-muted)]">
        {photos.length === 1
          ? 'Long receipt? Add more pages before analyzing.'
          : 'Tap ✕ to drop a page, or add more.'}
      </p>

      <button
        type="button"
        onClick={onAnalyze}
        className="mt-3 flex min-h-[48px] w-full items-center justify-center rounded-xl bg-[var(--color-brand-red)] px-4 py-3 text-sm font-medium text-white hover:bg-[var(--color-brand-red-hover)]"
      >
        Analyze receipt
      </button>
      <button
        type="button"
        onClick={onGallery}
        className="mt-2 flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl border border-[var(--color-brand-border)] px-4 py-2.5 text-sm text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)]"
      >
        <Images className="h-4 w-4" /> Add from gallery
      </button>
    </div>
  )
}

function ResultView({
  result,
  preview,
  pageCount,
  onConfirm,
  onRescan,
  onCancel,
  onChange,
}: {
  result: ScannedReceipt
  preview: string | null
  pageCount: number
  onConfirm: () => void
  onRescan: () => void
  onCancel: () => void
  onChange: (next: Partial<ScannedReceipt>) => void
}) {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between">
        <p className="text-base font-semibold text-[var(--color-brand-text-primary)]">Review &amp; save</p>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Close"
          className="inline-flex h-11 w-11 items-center justify-center rounded-full text-[var(--color-brand-text-muted)] hover:bg-[var(--color-brand-elevated)]"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Hero: the amount is the focal point. */}
      <div className="mt-2 flex items-center gap-3 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-4">
        {preview ? (
          <div className="relative flex-shrink-0">
            <Image
              src={preview}
              alt="Receipt preview"
              width={64}
              height={88}
              unoptimized
              className="h-20 w-16 rounded-lg border border-[var(--color-brand-border)] object-cover"
            />
            {pageCount > 1 ? (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--color-brand-red)] px-1 text-[10px] font-semibold text-white">
                {pageCount}
              </span>
            ) : null}
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <span className="mb-0.5 block text-xs text-[var(--color-brand-text-muted)]">Total amount</span>
          <div className="flex items-center gap-2">
            <AmountField
              bare
              value={String(result.amount)}
              onChange={(v) => onChange({ amount: Number(v) || 0 })}
              className="w-full bg-transparent text-2xl font-semibold text-[var(--color-brand-text-primary)] outline-none"
            />
            <CurrencyField
              value={result.currency}
              onChange={(c) => onChange({ currency: c as Currency })}
              codes={SUPPORTED_CURRENCIES}
              className="rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-2 py-1.5 text-sm"
            />
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        <Field label="Merchant">
          <input
            value={result.merchant}
            onChange={(e) => onChange({ merchant: e.target.value })}
            placeholder="Where you spent"
            className="h-12 w-full rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3 text-sm text-[var(--color-brand-text-primary)]"
          />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Category">
            <select
              value={result.category}
              onChange={(e) => onChange({ category: e.target.value as ExpenseCategory })}
              className="h-12 w-full rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3 text-sm text-[var(--color-brand-text-primary)]"
            >
              {SUPPORTED_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Date">
            <DatePickerField value={result.date} onChange={(date) => onChange({ date })} />
          </Field>
        </div>
      </div>

      <ReceiptBreakdown result={result} onChange={onChange} />

      <div className="mt-4 flex flex-col gap-2">
        <button
          type="button"
          onClick={onConfirm}
          className="flex min-h-[48px] w-full items-center justify-center gap-1.5 rounded-xl bg-[var(--color-brand-red)] px-4 py-3 text-sm font-medium text-white hover:bg-[var(--color-brand-red-hover)]"
        >
          <Check className="h-4 w-4" /> Save expense
        </button>
        <button
          type="button"
          onClick={onRescan}
          className="flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl border border-[var(--color-brand-border)] px-4 py-2.5 text-sm text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)]"
        >
          <RefreshCcw className="h-4 w-4" /> Rescan
        </button>
      </div>
    </div>
  )
}

function ReceiptBreakdown({
  result,
  onChange,
}: {
  result: ScannedReceipt
  onChange: (next: Partial<ScannedReceipt>) => void
}) {
  const { items, charges, amount, currency } = result
  if (items.length === 0 && charges.length === 0) return null

  // `price` is the printed line total; qty is informational only (don't multiply).
  const breakdownSum =
    items.reduce((s, it) => s + it.price, 0) +
    charges.reduce((s, c) => s + c.amount, 0)
  const mismatch = Math.abs(breakdownSum - amount) > 0.01

  const fmt = (n: number) => `${n.toFixed(2)} ${currency}`

  return (
    <div className="mt-3 rounded-xl border border-[var(--color-brand-border)] p-3">
      <p className="mb-2 text-xs font-semibold text-[var(--color-brand-text-secondary)]">Breakdown</p>

      {items.length > 0 ? (
        <ul className="space-y-1">
          {items.map((it, i) => (
            <li key={`item-${i}`} className="flex items-center gap-2 text-sm">
              <span className="flex-1 truncate text-[var(--color-brand-text-primary)]">
                {it.qty && it.qty > 1 ? `${it.qty}× ` : ''}{it.name}
              </span>
              <span className="tabular-nums text-[var(--color-brand-text-secondary)]">{fmt(it.price)}</span>
              <button
                type="button"
                aria-label={`Remove ${it.name}`}
                onClick={() => onChange({ items: items.filter((_, idx) => idx !== i) })}
                className="text-[var(--color-brand-text-muted)] hover:text-[var(--color-brand-red)]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {charges.length > 0 ? (
        <ul className="mt-2 space-y-1 border-t border-[var(--color-brand-border)] pt-2">
          {charges.map((c, i) => (
            <li key={`charge-${i}`} className="flex items-center gap-2 text-sm">
              <span className="flex-1 truncate text-[var(--color-brand-text-muted)]">{c.label}</span>
              <span className="tabular-nums text-[var(--color-brand-text-secondary)]">{fmt(c.amount)}</span>
              <button
                type="button"
                aria-label={`Remove ${c.label}`}
                onClick={() => onChange({ charges: charges.filter((_, idx) => idx !== i) })}
                className="text-[var(--color-brand-text-muted)] hover:text-[var(--color-brand-red)]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {mismatch ? (
        <p className="mt-2 text-xs text-[var(--color-brand-amber)]">
          Breakdown sums to {fmt(breakdownSum)} but the total reads {fmt(amount)}. The total is what gets saved.
        </p>
      ) : null}
    </div>
  )
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block text-xs text-[var(--color-brand-text-muted)] ${className}`}>
      <span className="mb-1 block">{label}</span>
      {children}
    </label>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col items-center gap-3 py-6">{children}</div>
}
