'use client'

import { useEffect, useState, useCallback } from 'react'
import { Camera, Check, X, Loader2, AlertTriangle, RefreshCcw } from 'lucide-react'
import Image from 'next/image'
import { useShallow } from 'zustand/react/shallow'
import { ModalShell } from '@/components/modals/ModalShell'
import { captureReceiptPhoto } from '@/lib/native/cameraScanner'
import { apiUrl } from '@/lib/apiBase'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { Currency, ExpenseCategory } from '@/lib/store/types'

type ScanState = 'idle' | 'scanning' | 'parsing' | 'result' | 'error'

interface ScannedReceipt {
  merchant: string
  amount: number
  currency: Currency
  date: string
  category: ExpenseCategory
  confidence: number
  rawTotalText: string
  notes: string
}

interface ReceiptScanSheetProps {
  open: boolean
  onClose: () => void
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

export function ReceiptScanSheet({ open, onClose }: ReceiptScanSheetProps) {
  const [state, setState] = useState<ScanState>('idle')
  const [preview, setPreview] = useState<string | null>(null)
  const [result, setResult] = useState<ScannedReceipt | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { addExpense, paymentMethods, baseCurrency } = useFinanceStore(
    useShallow((s) => ({
      addExpense: s.addExpense,
      paymentMethods: s.paymentMethods,
      baseCurrency: s.settings.baseCurrency,
    })),
  )

  const reset = useCallback(() => {
    setState('idle')
    setPreview(null)
    setResult(null)
    setError(null)
  }, [])

  useEffect(() => {
    if (!open) reset()
  }, [open, reset])

  const startScan = useCallback(async () => {
    setError(null)
    setState('scanning')
    try {
      const captured = await captureReceiptPhoto()
      setPreview(captured.dataUrl)
      setState('parsing')

      const form = new FormData()
      form.append('image', captured.file)
      const res = await fetch(apiUrl('/api/receipt/scan'), { method: 'POST', body: form, credentials: 'include' })
      if (!res.ok) {
        if (res.status === 503) {
          throw new Error('AI scanning is temporarily offline. Please set up manually or try again in a moment.')
        }
        if (res.status === 422) {
          throw new Error('We had trouble reading this receipt image. Please ensure the total amount and merchant are clearly visible, then try again.')
        }
        if (res.status === 429) {
          throw new Error('Receipt scanning limit reached. Please try again in a moment.')
        }
        if (res.status === 401) {
          throw new Error('Please sign in to use receipt scanning.')
        }
        const err = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(err?.error || `Scan failed (${res.status})`)
      }
      const data = (await res.json()) as { receipt: Record<string, unknown> }
      const r = normaliseReceipt(data.receipt, baseCurrency)
      setResult(r)
      setState('result')
    } catch (e) {
      const msg =
        e instanceof TypeError
          ? 'Network connection lost. Please check your internet and try again.'
          : e instanceof Error
            ? e.message
            : 'Could not scan that receipt'
      setError(msg)
      setState('error')
    }
  }, [baseCurrency])

  useEffect(() => {
    if (open && state === 'idle') {
      void startScan()
    }
  }, [open, state, startScan])

  const confirm = () => {
    if (!result) return
    const defaultPm = paymentMethods.find((pm) => pm.isDefault) ?? paymentMethods[0]
    const date = result.date || new Date().toISOString().slice(0, 10)
    addExpense({
      date,
      description: result.merchant || 'Scanned receipt',
      category: result.category,
      amount: result.amount,
      currency: result.currency,
      paymentMethodId: defaultPm?.id ?? '',
      isRecurring: false,
      notes: result.notes ? `receipt: ${result.notes}` : 'receipt scan',
    })
    onClose()
  }

  return (
    <ModalShell
      open={open}
      onBackdropClick={onClose}
      dragToClose
      panelClassName="!max-h-[min(86vh,720px)]"
    >
      {state === 'scanning' ? <Centered><Loader2 className="h-8 w-8 animate-spin text-[var(--color-brand-red)]" /><p className="text-sm text-[var(--color-brand-text-secondary)]">Opening camera…</p></Centered> : null}

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

      {state === 'error' ? (
        <Centered>
          <AlertTriangle className="h-8 w-8 text-[var(--color-brand-amber)]" />
          <p className="text-sm font-medium text-[var(--color-brand-text-primary)]">Couldn&apos;t read that receipt</p>
          <p className="max-w-[280px] text-xs text-[var(--color-brand-text-muted)] text-center">{error}</p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => void startScan()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--color-brand-red)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-brand-red-hover)]"
            >
              <RefreshCcw className="h-4 w-4" /> Try again
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-3 py-2 text-sm text-[var(--color-brand-text-muted)] hover:bg-[var(--color-brand-elevated)]"
            >
              Close
            </button>
          </div>
        </Centered>
      ) : null}

      {state === 'result' && result ? (
        <ResultView
          result={result}
          preview={preview}
          onConfirm={confirm}
          onRescan={() => {
            reset()
            void startScan()
          }}
          onCancel={onClose}
          onChange={(next) => setResult({ ...result, ...next })}
        />
      ) : null}

      {state === 'idle' ? (
        <Centered>
          <Camera className="h-8 w-8 text-[var(--color-brand-text-muted)]" />
          <p className="text-sm text-[var(--color-brand-text-secondary)]">Tap below to take a photo of your receipt.</p>
          <button
            type="button"
            onClick={() => void startScan()}
            className="rounded-xl bg-[var(--color-brand-red)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-brand-red-hover)]"
          >
            Open camera
          </button>
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
          <input
            value={String(result.amount)}
            onChange={(e) => onChange({ amount: Number(e.target.value) || 0 })}
            inputMode="decimal"
            className="w-full rounded-lg border border-[var(--color-brand-border)] bg-transparent px-2 py-1.5 text-sm text-[var(--color-brand-text-primary)]"
          />
        </Field>
        <Field label="Currency">
          <select
            value={result.currency}
            onChange={(e) => onChange({ currency: e.target.value as Currency })}
            className="w-full rounded-lg border border-[var(--color-brand-border)] bg-transparent px-2 py-1.5 text-sm text-[var(--color-brand-text-primary)]"
          >
            {SUPPORTED_CURRENCIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
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
          <input
            type="date"
            value={result.date}
            onChange={(e) => onChange({ date: e.target.value })}
            className="w-full rounded-lg border border-[var(--color-brand-border)] bg-transparent px-2 py-1.5 text-sm text-[var(--color-brand-text-primary)]"
          />
        </Field>
      </div>

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
  const date = /^\d{4}-\d{2}-\d{2}$/.test(dateRaw) ? dateRaw : ''

  const confidenceRaw = typeof raw.confidence === 'number' ? raw.confidence : 0.5
  const confidence = Math.max(0, Math.min(1, confidenceRaw))

  return {
    merchant,
    amount: Number.isFinite(amount) && amount > 0 ? amount : 0,
    currency,
    date,
    category,
    confidence,
    rawTotalText: (raw.rawTotalText as string | undefined) ?? '',
    notes: (raw.notes as string | undefined)?.toString().slice(0, 120) ?? '',
  }
}
