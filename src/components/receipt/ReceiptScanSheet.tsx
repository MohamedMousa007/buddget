'use client'

import { formatFixed2 } from '@/lib/utils/formatters'
import { useEffect, useRef, useState, useCallback } from 'react'
import { localTodayISO } from '@/lib/utils/localDate'
import { Camera, Check, X, ScanLine, ReceiptText, RefreshCcw, Images } from 'lucide-react'
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
import { useBuddgyMoodWhile, useBuddgyMoodOnce } from '@/lib/ai/useBuddgyMood'
import { BuddgyIcon } from '@/components/ai/BuddgyIcon'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/IconButton'
import {
  normaliseReceipt,
  reconcileMissingItems,
  isUnknownItem,
  SUPPORTED_CURRENCIES,
  SUPPORTED_CATEGORIES,
  type ScannedReceipt,
} from '@/lib/receipt/normaliseReceipt'
import { parseLocalizedAmount } from '@/lib/ui/amountParse'
import { reconcileTyped } from '@/lib/ui/typedAmount'
import { useT } from '@/lib/i18n'

type ScanState = 'idle' | 'scanning' | 'parsing' | 'result' | 'notReceipt' | 'error' | 'queued'

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
  const t = useT()
  const rc = t.receiptScan
  const [state, setState] = useState<ScanState>('idle')

  // Buddgy reflects the OCR pipeline: scanning while it reads, then the outcome.
  useBuddgyMoodWhile('scanning', state === 'scanning' || state === 'parsing')
  useBuddgyMoodOnce('done', state === 'result')
  useBuddgyMoodOnce('error', state === 'error' || state === 'notReceipt')
  const [photos, setPhotos] = useState<CapturedImage[]>([])
  const [preview, setPreview] = useState<string | null>(null)
  const [result, setResult] = useState<ScannedReceipt | null>(null)
  const [error, setError] = useState<string | null>(null)
  const scanAbortRef = useRef<AbortController | null>(null)
  const savedRef = useRef(false)

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
    savedRef.current = false
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
        if (res.status === 503) throw new Error(rc.errors.unavailable)
        if (res.status === 422) throw new Error(rc.errors.unreadable)
        if (res.status === 429) throw new Error(rc.errors.limitReached)
        if (res.status === 401) throw new Error(rc.errors.signInRequired)
        if (res.status === 413) throw new Error(rc.errors.tooLarge)
        const err = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(err?.error || rc.errors.scanFailed(res.status))
      }
      const data = (await res.json()) as { receipt?: Record<string, unknown> | null }
      if (!data.receipt) throw new Error(rc.errors.unreadable)
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
        ? rc.errors.offline
        : e instanceof TypeError
          ? rc.errors.networkLost
          : e instanceof Error
            ? e.message
            : rc.errors.scanFallback
      setError(msg)
      setState('error')
    }
  }, [baseCurrency, seed, rc])

  /**
   * Opens the native document scanner and sends the captured pages straight to
   * the AI. The scanner already owns multi-page capture, cropping and gallery
   * import, so there's no separate in-app review step.
   */
  const runScan = useCallback(async (source: 'camera' | 'gallery') => {
    setError(null)
    setState('scanning')
    try {
      const captured = await scanDocument(source)
      if (captured.length === 0) throw new ReceiptCaptureCancelled()
      void haptic()
      setPhotos(captured)
      await submitPhotos(captured)
    } catch (e) {
      if (e instanceof ReceiptCaptureCancelled) {
        // Intentional back-out: close on native, return to idle on web. Show nothing.
        if (isNative()) onClose()
        else setState('idle')
        return
      }
      setError(e instanceof Error ? e.message : rc.errors.scannerFallback)
      setState('error')
    }
  }, [onClose, submitPhotos, rc])

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
      if (!res.ok) throw new Error(res.status === 413 ? rc.errors.tooLarge : rc.errors.scanFailed(res.status))
      const data = (await res.json()) as { receipt?: Record<string, unknown> | null }
      if (!data.receipt) throw new Error(rc.errors.storedImageUnreadable)
      if (ctrl.signal.aborted) return
      const normalised = normaliseReceipt(data.receipt, baseCurrency)
      setResult(normalised)
      setState(normalised.isReceipt ? 'result' : 'notReceipt')
    } catch (e) {
      if (ctrl.signal.aborted) return
      setError(e instanceof Error ? e.message : rc.errors.scanFallback)
      setState('error')
    }
  }, [seed, baseCurrency, rc])

  // ponytail: web auto-start skipped — input.click() from useEffect lacks user gesture on mobile browsers
  useEffect(() => {
    if (!open || state !== 'idle') return
    if (seed) void startSeedScan()
    else if (isNative()) void runScan('camera')
  }, [open, state, seed, startSeedScan, runScan])

  const confirm = () => {
    if (!result || !(result.amount > 0) || savedRef.current) return
    savedRef.current = true
    const defaultPm = paymentMethods.find((pm) => pm.isDefault) ?? paymentMethods[0]
    const paymentMethodId = defaultPm?.id ?? ''
    const date = result.date || localTodayISO()

    // When the scan produced a breakdown, persist it as one receipt row and link
    // the single total expense to it. No breakdown → behave exactly as before.
    // Saving = the user confirmed the total, so fill any breakdown shortfall
    // into the unknown/unread placeholder lines to make the receipt reconcile.
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
          items: reconcileMissingItems(result.items, result.charges, result.amount),
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
      ariaLabel={t.common.receiptSheetLabel}
      panelClassName="!max-h-[min(86vh,720px)]"
    >
      {state === 'scanning' ? (
        <ProcessingView preview={null} title={rc.openingCamera} subtitle={rc.openingCameraHint} />
      ) : null}

      {state === 'parsing' ? (
        <ProcessingView
          preview={preview}
          title={rc.reading}
          subtitle={rc.readingHint}
        />
      ) : null}

      {state === 'queued' ? (
        <Centered>
          <Check className="h-8 w-8 text-[var(--color-brand-green)]" />
          <p className="text-sm font-medium text-[var(--color-brand-text-primary)]">{rc.captured}</p>
          <p className="max-w-72 text-xs text-[var(--color-brand-text-muted)] text-center">
            {rc.capturedOffline}
          </p>
          <Button
            type="button"
            onClick={onClose}
            size="touch" className="mt-2 hover:bg-[var(--color-brand-primary-hover)]"
          >
            {rc.done}
          </Button>
        </Centered>
      ) : null}

      {state === 'notReceipt' ? (
        <div className="relative">
          <IconButton
            onClick={onClose}
            aria-label={t.common.close}
            shape="round"
            className="absolute end-0 top-0"
          >
            <X />
          </IconButton>
          <Centered>
            <span className="text-[var(--color-brand-text)]">
              <BuddgyIcon mood="curious" size={56} strokeWidth={1.5} filled alive />
            </span>
            <p className="text-sm font-medium text-[var(--color-brand-text-primary)]">{rc.notReceiptTitle}</p>
            <p className="max-w-72 text-xs text-[var(--color-brand-text-muted)] text-center">
              {rc.notReceiptBody}
            </p>
            <div className="mt-1 flex flex-col items-stretch gap-2">
              <Button
                type="button"
                onClick={() => { reset(); void runScan('camera') }}
                size="touch" className="text-sm font-medium text-[var(--color-brand-on-primary)] hover:bg-[var(--color-brand-primary-hover)]"
              >
                <Camera className="h-4 w-4" /> {rc.scanAgain}
              </Button>
              <Button
                onClick={() => { reset(); void runScan('gallery') }}
                variant="outline"
                size="touch"
              >
                <Images className="h-4 w-4" /> {rc.chooseGallery}
              </Button>
            </div>
          </Centered>
        </div>
      ) : null}

      {state === 'error' ? (
        <div className="relative">
          <IconButton
            onClick={onClose}
            aria-label={t.common.close}
            shape="round"
            className="absolute end-0 top-0"
          >
            <X />
          </IconButton>
          <Centered>
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-brand-elevated)]">
              <ReceiptText className="h-7 w-7 text-[var(--color-brand-text-muted)]" />
            </div>
            <p className="text-sm font-medium text-[var(--color-brand-text-primary)]">{rc.tryAgainTitle}</p>
            <p className="max-w-72 text-xs text-[var(--color-brand-text-muted)] text-center">{error}</p>
            {photos.length > 0 ? (
              <Button
                type="button"
                onClick={() => void submitPhotos(photos)}
                size="touch" className="mt-1 text-sm font-medium text-[var(--color-brand-on-primary)] hover:bg-[var(--color-brand-primary-hover)]"
              >
                <RefreshCcw className="h-4 w-4" /> {rc.tryAgain}
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => void runScan('camera')}
                size="touch" className="mt-1 text-sm font-medium text-[var(--color-brand-on-primary)] hover:bg-[var(--color-brand-primary-hover)]"
              >
                <RefreshCcw className="h-4 w-4" /> {rc.scanAgain}
              </Button>
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
            if (isNative()) void runScan('camera')
          }}
          onCancel={onClose}
          onChange={(next) => setResult({ ...result, ...next })}
        />
      ) : null}

      {state === 'idle' ? (
        <Centered>
          <Camera className="h-8 w-8 text-[var(--color-brand-text-muted)]" />
          <p className="text-sm text-[var(--color-brand-text-secondary)]">{rc.idlePrompt}</p>
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={() => void runScan('camera')}
              size="touch" className="text-sm font-medium text-[var(--color-brand-on-primary)] hover:bg-[var(--color-brand-primary-hover)]"
            >
              <Camera className="h-4 w-4" /> {rc.scan}
            </Button>
            <Button
              onClick={() => void runScan('gallery')}
              variant="outline"
              size="touch"
            >
              <Images className="h-4 w-4" /> {rc.gallery}
            </Button>
          </div>
        </Centered>
      ) : null}
    </ModalShell>
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
  const { receiptScan: rc, common } = useT()
  const categoryLabels = useT().expenseForm.categoryLabels
  const [amountDraft, setAmountDraft] = useState(String(result.amount))
  return (
    <div className="w-full">
      <div className="flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-2.5">
          {preview ? (
            <div className="relative flex-shrink-0">
              <Image
                src={preview}
                alt={rc.previewAlt}
                width={44}
                height={60}
                unoptimized
                className="h-12 w-9 rounded-lg border border-[var(--color-brand-border)] object-cover"
              />
              {pageCount > 1 ? (
                <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-brand-primary)] px-1 text-[9px] font-semibold text-[var(--color-brand-on-primary)]">
                  {pageCount}
                </span>
              ) : null}
            </div>
          ) : null}
          <p className="truncate text-base font-semibold text-[var(--color-brand-text-primary)]">{rc.reviewTitle}</p>
        </div>
        <IconButton
          onClick={onCancel}
          aria-label={common.close}
          shape="round"
          className="shrink-0"
        >
          <X className="h-5 w-5" />
        </IconButton>
      </div>

      {/* Amount + currency — mirrors the expense sheet's field pattern. */}
      <div className="mt-4 grid grid-cols-[1fr_112px] items-end gap-3">
        <Field label={rc.amount}>
          <AmountField
            bare
            value={reconcileTyped(amountDraft, result.amount)}
            onChange={(v) => {
              setAmountDraft(v)
              onChange({ amount: parseLocalizedAmount(v, result.currency) || 0 })
            }}
            className="flex h-12 w-full items-center rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3.5 text-start font-mono-numbers text-2xl font-bold tracking-[-0.02em] text-[var(--color-brand-text-primary)]"
          />
        </Field>
        <Field label={rc.currency}>
          <CurrencyField
            value={result.currency}
            onChange={(c) => onChange({ currency: c as Currency })}
            codes={SUPPORTED_CURRENCIES}
            compact
            className="h-12 w-full rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3 text-base font-semibold"
          />
        </Field>
      </div>

      <div className="mt-3 space-y-2">
        <Field label={rc.merchant}>
          <input
            value={result.merchant}
            onChange={(e) => onChange({ merchant: e.target.value })}
            placeholder={rc.merchantPlaceholder}
            className="h-12 w-full rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3.5 text-sm text-[var(--color-brand-text-primary)]"
          />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label={rc.category}>
            <select
              value={result.category}
              onChange={(e) => onChange({ category: e.target.value as ExpenseCategory })}
              className="h-12 w-full rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3 text-sm text-[var(--color-brand-text-primary)]"
            >
              {SUPPORTED_CATEGORIES.map((c) => (
                <option key={c} value={c}>{categoryLabels[c] ?? c}</option>
              ))}
            </select>
          </Field>
          <Field label={rc.date}>
            <DatePickerField value={result.date} onChange={(date) => onChange({ date })} />
          </Field>
        </div>
      </div>

      <ReceiptBreakdown result={result} onChange={onChange} />

      <div className="mt-4 flex flex-col gap-2">
        <Button
          type="button"
          onClick={onConfirm}
          disabled={!(result.amount > 0)}
          size="cta-block" className="text-sm font-medium text-[var(--color-brand-on-primary)] hover:bg-[var(--color-brand-primary-hover)]"
        >
          <Check className="h-4 w-4" /> {rc.saveExpense}
        </Button>
        <Button
          onClick={onRescan}
          variant="outline"
          size="cta-block"
        >
          <RefreshCcw className="h-4 w-4" /> {rc.rescan}
        </Button>
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
  const { receiptScan: rc, a11y } = useT()
  const { items, charges, amount, currency } = result
  if (items.length === 0 && charges.length === 0) return null

  // `price` is the printed line total; qty is informational only (don't multiply).
  const breakdownSum =
    items.reduce((s, it) => s + it.price, 0) +
    charges.reduce((s, c) => s + c.amount, 0)
  const mismatch = Math.abs(breakdownSum - amount) > 0.01

  const fmt = (n: number) => `${n < 0 ? '-' : ''}${formatFixed2(n)} ${currency}`

  return (
    <div className="mt-3 rounded-xl border border-[var(--color-brand-border)] p-3">
      <p className="mb-2 text-xs font-semibold text-[var(--color-brand-text-secondary)]">{rc.breakdown}</p>

      {items.length > 0 ? (
        <ul className="space-y-1">
          {items.map((it, i) => {
            const unknown = isUnknownItem(it)
            return (
              <li key={`item-${i}`} className="flex items-center gap-2 text-sm">
                <span className={`flex-1 truncate ${unknown ? 'text-[var(--color-brand-amber)]' : 'text-[var(--color-brand-text-primary)]'}`}>
                  {it.qty && it.qty > 1 ? `${it.qty}× ` : ''}{it.name}
                </span>
                <span className={`tabular-nums ${unknown ? 'text-[var(--color-brand-amber)]' : 'text-[var(--color-brand-text-secondary)]'}`}>
                  {it.price === 0 ? '—' : fmt(it.price)}
                </span>
                <IconButton
                  aria-label={a11y.removeNamed(it.name)}
                  variant="danger"
                  onClick={() => onChange({ items: items.filter((_, idx) => idx !== i) })}
                >
                  <X className="size-3.5" />
                </IconButton>
              </li>
            )
          })}
        </ul>
      ) : null}

      {charges.length > 0 ? (
        <ul className="mt-2 space-y-1 border-t border-[var(--color-brand-border)] pt-2">
          {charges.map((c, i) => (
            <li key={`charge-${i}`} className="flex items-center gap-2 text-sm">
              <span className="flex-1 truncate text-[var(--color-brand-text-muted)]">{c.label}</span>
              <span className="tabular-nums text-[var(--color-brand-text-secondary)]">{fmt(c.amount)}</span>
              <IconButton aria-label={a11y.removeNamed(c.label)} onClick={() => onChange({ charges: charges.filter((_, idx) => idx !== i) })}>
                <X className="h-3.5 w-3.5" />
              </IconButton>
            </li>
          ))}
        </ul>
      ) : null}

      {mismatch ? (
        <p className="mt-2 text-xs text-[var(--color-brand-amber)]">
          {breakdownSum < amount
            ? rc.unassigned(fmt(Math.round((amount - breakdownSum) * 100) / 100))
            : rc.mismatch(fmt(breakdownSum), fmt(amount))}
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

/** Framed scan-line loader for the opening-camera and reading states. */
function ProcessingView({ preview, title, subtitle }: { preview: string | null; title: string; subtitle: string }) {
  const rc = useT().receiptScan
  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <div className="relative">
      <div className="relative h-44 w-32 overflow-hidden rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]">
        {preview ? (
          <Image src={preview} alt={rc.receiptAlt} fill unoptimized className="object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ScanLine className="h-10 w-10 text-[var(--color-brand-text-muted)]" />
          </div>
        )}
        <span className="rsl-sweep" aria-hidden />
      </div>
        {/* Buddgy peeks over the corner, reading along */}
        <span className="absolute -bottom-4 -end-6 text-[var(--color-brand-text)]">
          <BuddgyIcon mood="scanning" size={48} strokeWidth={1.5} filled alive />
        </span>
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-[var(--color-brand-text-primary)]">{title}</p>
        <p className="mt-1 max-w-64 text-xs text-[var(--color-brand-text-muted)]">{subtitle}</p>
      </div>
      <style>{`
        .rsl-sweep {
          position: absolute; left: 0; right: 0; top: -45%; height: 45%;
          background: linear-gradient(to bottom, transparent, rgba(18,176,160,.28), rgba(18,176,160,.55), rgba(18,176,160,.28), transparent);
          animation: rslSweep 1.5s cubic-bezier(.4,0,.6,1) infinite;
        }
        @keyframes rslSweep { 0% { top: -45%; } 100% { top: 100%; } }
        @media (prefers-reduced-motion: reduce) { .rsl-sweep { animation: none; opacity: .5; top: 45%; } }
      `}</style>
    </div>
  )
}
