'use client'

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { AlertDialog } from '@base-ui/react/alert-dialog'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n'

/**
 * Imperative confirm / alert dialog infrastructure.
 *
 * Usage:
 *   const confirm = useConfirm()
 *   if (await confirm({ title: 'Delete?', body: '...', destructive: true })) { ... }
 *
 *   const alert = useAlert()
 *   await alert({ title: 'Oops', body: '...' })
 *
 * Multiple concurrent calls queue FIFO — the next prompt opens after the
 * current one resolves. Dialogs are rendered via Base UI's `AlertDialog`
 * (modal, focus-trapped, escape-to-close, focus returns to the trigger on
 * dismiss).
 */

export interface ConfirmOptions {
  title: string
  body?: string
  confirmLabel?: string
  cancelLabel?: string
  /** Renders the confirm button in brand-red; intended for delete actions. */
  destructive?: boolean
}

export interface AlertOptions {
  title: string
  body?: string
  okLabel?: string
}

interface QueueItem {
  kind: 'confirm' | 'alert'
  options: ConfirmOptions | AlertOptions
  resolve: (result: boolean) => void
}

interface DialogContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>
  alert: (options: AlertOptions) => Promise<void>
}

const DialogContext = createContext<DialogContextValue | null>(null)

export function useConfirm(): (options: ConfirmOptions) => Promise<boolean> {
  const ctx = useContext(DialogContext)
  if (!ctx) throw new Error('useConfirm must be used within a DialogProvider')
  return ctx.confirm
}

export function useAlert(): (options: AlertOptions) => Promise<void> {
  const ctx = useContext(DialogContext)
  if (!ctx) throw new Error('useAlert must be used within a DialogProvider')
  return ctx.alert
}

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const t = useT()
  const [queue, setQueue] = useState<QueueItem[]>([])
  const current = queue[0] ?? null

  const push = useCallback(
    <T extends 'confirm' | 'alert'>(
      kind: T,
      options: T extends 'confirm' ? ConfirmOptions : AlertOptions,
    ): Promise<boolean> =>
      new Promise<boolean>((resolve) => {
        setQueue((q) => [...q, { kind, options, resolve }])
      }),
    [],
  )

  const confirm = useCallback(
    (options: ConfirmOptions) => push('confirm', options),
    [push],
  )
  const alert = useCallback(
    (options: AlertOptions) => push('alert', options).then(() => undefined),
    [push],
  )

  const value = useMemo<DialogContextValue>(
    () => ({ confirm, alert }),
    [confirm, alert],
  )

  const resolveCurrent = useCallback(
    (result: boolean) => {
      if (!current) return
      current.resolve(result)
      setQueue((q) => q.slice(1))
    },
    [current],
  )

  const isConfirm = current?.kind === 'confirm'
  const opts = current?.options
  const destructive = isConfirm && (opts as ConfirmOptions).destructive === true
  const confirmLabel = isConfirm
    ? (opts as ConfirmOptions).confirmLabel ??
      (destructive ? t.ui.confirm.destructiveConfirm : t.ui.confirm.confirm)
    : (opts as AlertOptions | undefined)?.okLabel ?? t.ui.alert.ok
  const cancelLabel = isConfirm
    ? (opts as ConfirmOptions).cancelLabel ?? t.ui.confirm.cancel
    : null

  return (
    <DialogContext.Provider value={value}>
      {children}
      <AlertDialog.Root
        open={current != null}
        onOpenChange={(nextOpen) => {
          // Closing via backdrop / escape counts as "cancel" for confirms,
          // "acknowledge" for alerts.
          if (!nextOpen) resolveCurrent(!isConfirm)
        }}
      >
        <AlertDialog.Portal>
          <AlertDialog.Backdrop
            className={cn(
              'fixed inset-0 z-[110] bg-black/50 backdrop-blur-sm',
              'data-[open]:animate-in data-[closed]:animate-out',
              'data-[open]:fade-in-0 data-[closed]:fade-out-0',
            )}
          />
          <AlertDialog.Popup
            className={cn(
              'fixed left-1/2 top-1/2 z-[111] w-[min(92vw,24rem)] -translate-x-1/2 -translate-y-1/2',
              'rounded-2xl border p-5 shadow-2xl outline-none',
              'bg-[var(--color-brand-card)] border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)]',
              'data-[open]:animate-in data-[closed]:animate-out',
              'data-[open]:fade-in-0 data-[closed]:fade-out-0',
              'data-[open]:zoom-in-95 data-[closed]:zoom-out-95',
            )}
          >
            {opts ? (
              <>
                <AlertDialog.Title className="text-base font-semibold">
                  {opts.title}
                </AlertDialog.Title>
                {opts.body ? (
                  <AlertDialog.Description className="mt-2 text-sm text-[var(--color-brand-text-secondary)] whitespace-pre-line">
                    {opts.body}
                  </AlertDialog.Description>
                ) : null}
                <div className="mt-5 flex items-center justify-end gap-2">
                  {cancelLabel ? (
                    <button
                      type="button"
                      onClick={() => resolveCurrent(false)}
                      className={cn(
                        'h-9 rounded-lg px-3 text-sm font-medium',
                        'text-[var(--color-brand-text-secondary)] hover:text-[var(--color-brand-text-primary)]',
                        'hover:bg-[var(--color-brand-elevated)]',
                      )}
                    >
                      {cancelLabel}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => resolveCurrent(true)}
                    className={cn(
                      'h-9 rounded-lg px-4 text-sm font-semibold transition-colors',
                      destructive
                        ? 'text-white bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)]'
                        : 'text-[var(--color-brand-bg)] bg-[var(--color-brand-text-primary)] hover:opacity-90',
                    )}
                  >
                    {confirmLabel}
                  </button>
                </div>
              </>
            ) : null}
          </AlertDialog.Popup>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </DialogContext.Provider>
  )
}
