'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Camera, Check, X, Loader2, ReceiptText, RefreshCcw, Images } from 'lucide-react'
import Image from 'next/image'
import { useShallow } from 'zustand/react/shallow'
import { ModalShell } from '@/components/modals/ModalShell'
import { DatePickerField } from '@/components/ui/DatePickerField'
import { CurrencyField } from '@/components/ui/CurrencyField'
import { AmountField } from '@/components/ui/AmountField'
import { capturePhoto, ReceiptCaptureCancelled, type CapturedImage } from '@/lib/native/cameraScanner'
import { isNative } from '@/lib/native/isNative'
import { saveReceiptImage } from '@/lib/native/receiptImages'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { isOnline } from '@/hooks/useNetworkStatus'
import { registerBackGuard } from '@/lib/navigation/backGuard'
import { newClientId } from '@/lib/store/useFinanceStore'
import { usePendingAiJobs, savePendingMedia, deletePendingMedia } from '@/lib/store/usePendingAiJobs'
import type { Currency, ExpenseCategory, ReceiptItem, ReceiptCharge } from '@/lib/store/types'

type ScanState = 'idle' | 'scanning' | 'captured' | 'parsing' | 'result' | 'error' | 'queued'

interface ScannedReceipt {
  merchant: string
  amount: number
  currency: Currency
  date: string
  category: ExpenseCategory
  confidence: number
  items: ReceiptItem[]
  charges: ReceiptCharge[]
  notes: string
}

const CHARGE_TYPES: ReceiptCharge['type'][] = ['tax', 'service', 'tip', 'discount', 'other']

interface ReceiptScanSheetProps {
  open: boolean
  onClose: () => void
  /** Review an offline-queued capture: skips the camera and parses this image. */
  seed?: { jobId: string; dataUrl: string } | null
  /** Fired when the user confirms the parsed result (used to clear queued jobs). */
  onConfirmed?: () => void
}

const SUPPORTED_CURRENCIES: Currency[] = [
  'EGP',
  'AED',
  'SAR',
  'QAR',
  'KWD',
  'OMR',
  'BHD',
  'USD',
]

const SUPPORTED_CATEGORIES: ExpenseCategory[] = [
  'Food',
  'Transport',
  'Enjoyment',
  'Rent',
  'Other',
]

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

  /** Captures one photo (camera or gallery) and appends it to the photos list. */
  const captureOne = useCallback(async (source: 'camera' | 'gallery', currentPhotos: CapturedImage[]) => {
    setError(null)
    setState('scanning')
    try {
      const captured = await capturePhoto(source)
      setPhotos(prev => [...prev, captured])
      setState('captured')
    } catch (e) {
      if (e instanceof ReceiptCaptureCancelled) {
        if (currentPhotos.length > 0) setState('captured')
        else if (isNative()) onClose()
        else setState('idle')
        return
      }
      setError(e instanceof Error ? e.message : 'Could not capture photo')
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
        if (res.status === 422) throw new Error('We had trouble reading this receipt image. Please ensure the total amount and merchant are clearly visible, then try again.')
        if (res.status === 429) throw new Error('Receipt scanning limit reached. Please try again in a moment.')
        if (res.status === 401) throw new Error('Please sign in to use receipt scanning.')
        const err = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(err?.error || `Scan failed (${res.status})`)
      }
      const data = (await res.json()) as { receipt?: Record<string, unknown> | null }
      if (!data.receipt) throw new Error('We had trouble reading this receipt image. Please ensure the total amount and merchant are clearly visible, then try again.')
      if (ctrl.signal.aborted) return
      setResult(normaliseReceipt(data.receipt, baseCurrency))
      setState('result')
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
      setResult(normaliseReceipt(data.receipt, baseCurrency))
      setState('result')
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
    else if (isNative()) void captureOne('camera', [])
  }, [open, state, seed, startSeedScan, captureOne])

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
      {state === 'scanning' ? <Centered><Loader2 className="h-8 w-8 animate-spin text-[var(--color-brand-red)]" /><p className="text-sm text-[var(--color-brand-text-secondary)]">Opening camera…</p></Centered> : null}

      {state === 'captured' ? (
        <div className="w-full">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {photos.map((p, i) => (
              <div key={i} className="relative flex-shrink-0">
                <Image
                  src={p.dataUrl}
                  alt={`Receipt photo ${i + 1}`}
                  width={80}
                  height={120}
                  unoptimized
                  className="h-28 w-20 rounded-xl border border-[var(--color-brand-border)] object-cover"
                />
                {photos.length > 1 ? (
                  <button
                    type="button"
                    aria-label={`Remove photo ${i + 1}`}
                    onClick={() => setPhotos(prev => prev.filter((_, idx) => idx !== i))}
                    className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]"
                  >
                    <X className="h-3 w-3 text-[var(--color-brand-text-muted)]" />
                  </button>
                ) : null}
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-[var(--color-brand-text-muted)]">
            {photos.length === 1 ? 'Receipt too long? Add more photos before analyzing.' : `${photos.length} photos captured.`}
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => void captureOne('camera', photos)}
              className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-[var(--color-brand-border)] px-3 py-2.5 text-sm text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)]"
            >
              <Camera className="h-4 w-4" /> Add photo
            </button>
            <button
              type="button"
              onClick={() => void captureOne('gallery', photos)}
              aria-label="Add from gallery"
              className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-[var(--color-brand-border)] px-3 py-2.5 text-sm text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)]"
            >
              <Images className="h-4 w-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => void submitPhotos(photos)}
            className="mt-2 flex min-h-[44px] w-full items-center justify-center rounded-xl bg-[var(--color-brand-red)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-brand-red-hover)]"
          >
            Analyze receipt
          </button>
          <button
            type="button"
            onClick={reset}
            className="mt-1 flex min-h-[44px] w-full items-center justify-center rounded-xl px-4 py-2 text-sm text-[var(--color-brand-text-muted)] hover:bg-[var(--color-brand-elevated)]"
          >
            Cancel
          </button>
        </div>
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
            className="mt-2 rounded-xl bg-[var(--color-brand-red)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-brand-red-hover)]"
          >
            Done
          </button>
        </Centered>
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
                onClick={() => setState('captured')}
                className="mt-1 inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-[var(--color-brand-red)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-brand-red-hover)]"
              >
                <RefreshCcw className="h-4 w-4" /> Back to photos
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void captureOne('camera', [])}
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
          onConfirm={confirm}
          onRescan={() => {
            reset()
            if (isNative()) void captureOne('camera', [])
          }}
          onCancel={onClose}
          onChange={(next) => setResult({ ...result, ...next })}
        />
      ) : null}

      {state === 'idle' ? (
        <Centered>
          <Camera className="h-8 w-8 text-[var(--color-brand-text-muted)]" />
          <p className="text-sm text-[var(--color-brand-text-secondary)]">Tap below to take a photo of your receipt.</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void captureOne('camera', [])}
              className="flex min-h-[44px] items-center gap-1.5 rounded-xl bg-[var(--color-brand-red)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-brand-red-hover)]"
            >
              <Camera className="h-4 w-4" /> Camera
            </button>
            <button
              type="button"
              onClick={() => void captureOne('gallery', [])}
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

function ResultView({
  result,
  preview,
  onConfirm,
  onRescan,
  onCancel,
  onChange,
}: {
  result: ScannedReceipt
  preview: string | null
  onConfirm: () => void
  onRescan: () => void
  onCancel: () => void
  onChange: (next: Partial<ScannedReceipt>) => void
}) {
  return (
    <div className="w-full">
      <div className="flex items-start gap-3">
        {preview ? (
          <Image
            src={preview}
            alt="Receipt preview"
            width={96}
            height={128}
            unoptimized
            className="h-24 w-20 rounded-xl border border-[var(--color-brand-border)] object-cover"
          />
        ) : null}
        <div className="flex-1">
          <p className="text-sm font-semibold text-[var(--color-brand-text-primary)]">Looks like an expense</p>
          <p className="text-xs text-[var(--color-brand-text-muted)]">
            AI confidence: {Math.round(result.confidence * 100)}%
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Field label="Merchant">
          <input
            value={result.merchant}
            onChange={(e) => onChange({ merchant: e.target.value })}
            className="w-full rounded-lg border border-[var(--color-brand-border)] bg-transparent px-2 py-1.5 text-sm text-[var(--color-brand-text-primary)]"
          />
        </Field>
        <Field label="Amount">
          <AmountField
            bare
            value={String(result.amount)}
            onChange={(v) => onChange({ amount: Number(v) || 0 })}
            className="w-full rounded-lg border border-[var(--color-brand-border)] bg-transparent px-2 py-1.5 text-sm text-[var(--color-brand-text-primary)]"
          />
        </Field>
        <Field label="Currency">
          <CurrencyField
            value={result.currency}
            onChange={(c) => onChange({ currency: c as Currency })}
            codes={SUPPORTED_CURRENCIES}
            className="w-full rounded-lg border border-[var(--color-brand-border)] bg-transparent px-2 py-1.5"
          />
        </Field>
        <Field label="Category">
          <select
            value={result.category}
            onChange={(e) => onChange({ category: e.target.value as ExpenseCategory })}
            className="w-full rounded-lg border border-[var(--color-brand-border)] bg-transparent px-2 py-1.5 text-sm text-[var(--color-brand-text-primary)]"
          >
            {SUPPORTED_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Date" className="col-span-2">
          <DatePickerField value={result.date} onChange={(date) => onChange({ date })} />
        </Field>
      </div>

      <ReceiptBreakdown result={result} onChange={onChange} />

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onConfirm}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--color-brand-red)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-brand-red-hover)]"
        >
          <Check className="h-4 w-4" /> Save expense
        </button>
        <button
          type="button"
          onClick={onRescan}
          className="rounded-xl border border-[var(--color-brand-border)] px-3 py-2.5 text-sm text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)]"
        >
          Rescan
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl px-3 py-2.5 text-sm text-[var(--color-brand-text-muted)] hover:bg-[var(--color-brand-elevated)]"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
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
    <div className="mt-4 rounded-xl border border-[var(--color-brand-border)] p-3">
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

function normaliseReceipt(raw: Record<string, unknown>, fallbackCurrency: Currency): ScannedReceipt {
  const merchant = (raw.merchant as string | undefined)?.trim().slice(0, 60) ?? ''
  const amountRaw = raw.amount
  const amount = typeof amountRaw === 'number'
    ? amountRaw
    : Number(typeof amountRaw === 'string' ? amountRaw.replace(/[^0-9.]/g, '') : 0)

  const currencyRaw = (raw.currency as string | undefined)?.trim().toUpperCase()
  const currency = (SUPPORTED_CURRENCIES as string[]).includes(currencyRaw ?? '')
    ? (currencyRaw as Currency)
    : ((SUPPORTED_CURRENCIES as string[]).includes(fallbackCurrency)
      ? fallbackCurrency
      : 'EGP')

  const categoryRaw = raw.category as string | undefined
  const category = (SUPPORTED_CATEGORIES as string[]).includes(categoryRaw ?? '')
    ? (categoryRaw as ExpenseCategory)
    : 'Other'

  const dateRaw = (raw.date as string | undefined)?.trim() ?? ''
  let date = /^\d{4}-\d{2}-\d{2}$/.test(dateRaw) ? dateRaw : ''
  // Discard AI dates that are in the future or more than 30 days old: the AI
  // often misreads old receipt photos or hallucinates future years. Dates
  // outside this window silently land in the wrong month and appear "missing".
  if (date) {
    const diffDays = (Date.now() - new Date(date + 'T00:00:00').getTime()) / 86400000
    if (diffDays < 0 || diffDays > 30) date = ''
  }

  const confidenceRaw = typeof raw.confidence === 'number' ? raw.confidence : 0.5
  const confidence = Math.max(0, Math.min(1, confidenceRaw))

  return {
    merchant,
    amount: Number.isFinite(amount) && amount > 0 ? amount : 0,
    currency,
    date,
    category,
    confidence,
    items: normaliseItems(raw.items),
    charges: normaliseCharges(raw.charges),
    notes: (raw.notes as string | undefined)?.toString().slice(0, 120) ?? '',
  }
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string') return Number(value.replace(/[^0-9.-]/g, ''))
  return NaN
}

function normaliseItems(raw: unknown): ReceiptItem[] {
  if (!Array.isArray(raw)) return []
  return raw
    .flatMap((entry) => {
      if (!entry || typeof entry !== 'object') return []
      const e = entry as Record<string, unknown>
      let name = (typeof e.name === 'string' ? e.name : '').trim().slice(0, 60)
      const price = toNumber(e.price)
      if (!name || !Number.isFinite(price)) return []
      let qty = toNumber(e.qty)
      // Safety net when the model leaves a quantity marker in the name ("2x Water", "x2 Water").
      const m = name.match(/^(?:x\s*(\d{1,3})|(\d{1,3})\s*[x×])\s+(.+)/i)
      if (m && !(Number.isFinite(qty) && qty > 0)) {
        qty = Number(m[1] ?? m[2])
        name = m[3].trim()
      }
      return [{ name, price, ...(Number.isFinite(qty) && qty > 0 ? { qty } : {}) }]
    })
    .slice(0, 100)
}

function normaliseCharges(raw: unknown): ReceiptCharge[] {
  if (!Array.isArray(raw)) return []
  return raw
    .flatMap((entry) => {
      if (!entry || typeof entry !== 'object') return []
      const e = entry as Record<string, unknown>
      const amount = toNumber(e.amount)
      if (!Number.isFinite(amount) || amount === 0) return []
      const type = CHARGE_TYPES.includes(e.type as ReceiptCharge['type'])
        ? (e.type as ReceiptCharge['type'])
        : 'other'
      const label = (typeof e.label === 'string' ? e.label : type).trim().slice(0, 40) || type
      return [{ type, label, amount }]
    })
    .slice(0, 20)
}
