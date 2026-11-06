'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { AlertDialog } from '@base-ui/react/alert-dialog'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useT } from '@/lib/i18n'
import { registerBackGuard } from '@/lib/navigation/backGuard'

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
  /** Renders the confirm button solid red; for actions that throw work away. */
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

  // Android back dismisses the dialog (cancel / acknowledge) before it reaches whatever sits underneath. Back only:
  // Base UI already owns Escape, and a second Escape handler would resolve the next queued prompt too.
  const dismissRef = useRef<() => void>(() => {})
  useEffect(() => { dismissRef.current = () => resolveCurrent(!isConfirm) })
  const hasCurrent = current != null
  useEffect(() => {
    if (!hasCurrent) return
    return registerBackGuard(() => { dismissRef.current(); return true })
  }, [hasCurrent])
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
              'fixed inset-0 z-[var(--z-dialog)] bg-black/60 backdrop-blur-sm',
              'data-[open]:animate-in data-[closed]:animate-out',
              'data-[open]:fade-in-0 data-[closed]:fade-out-0',
            )}
          />
          <AlertDialog.Popup
            className={cn(
              'fixed left-1/2 top-1/2 z-[calc(var(--z-dialog)+1)] w-[min(calc(100vw-32px),24rem)] -translate-x-1/2 -translate-y-1/2',
              'rounded-[20px] border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-5 shadow-[var(--shadow-lg)] outline-none',
              'text-[var(--color-brand-text-primary)]',
              'data-[open]:animate-in data-[closed]:animate-out',
              'data-[open]:fade-in-0 data-[closed]:fade-out-0',
              'data-[open]:zoom-in-95 data-[closed]:zoom-out-95',
            )}
          >
            {opts ? (
              <>
                <AlertDialog.Title className="text-lg font-bold">{opts.title}</AlertDialog.Title>
                {opts.body ? (
                  <AlertDialog.Description className="mt-1.5 whitespace-pre-line text-[0.84375rem] leading-[1.45] text-[var(--color-brand-text-secondary)]">
                    {opts.body}
                  </AlertDialog.Description>
                ) : null}
                {/* One row, equal columns: the DS pair — outline to back out, teal (or red when it destroys) to commit. */}
                <div className={cn('mt-5 grid gap-2', cancelLabel ? 'grid-cols-2' : 'grid-cols-1')}>
                  {cancelLabel ? (
                    <Button variant="outline" size="cta" onClick={() => resolveCurrent(false)}>
                      {cancelLabel}
                    </Button>
                  ) : null}
                  <Button variant={destructive ? 'destructive-solid' : 'default'} size="cta" onClick={() => resolveCurrent(true)}>
                    {confirmLabel}
                  </Button>
                </div>
              </>
            ) : null}
          </AlertDialog.Popup>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </DialogContext.Provider>
  )
}
