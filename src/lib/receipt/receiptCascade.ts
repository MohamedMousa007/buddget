import type { Receipt } from '@/lib/store/types'
import { deleteReceiptImage } from '@/lib/native/receiptImages'

/** The photo outlives the row for far longer than any Undo toast (8s, extended while held). */
const IMAGE_GRACE_MS = 30_000

type Held = { receipt: Receipt; timer: ReturnType<typeof setTimeout> | null }
const stash = new Map<string, Held>()

/** Deleting an expense deletes its receipt row now and its local photo after the undo window. */
export function dropExpenseReceipt(receiptId: string, receipts: Receipt[], deleteReceipt: (id: string) => void): void {
  const receipt = receipts.find((r) => r.id === receiptId)
  if (!receipt) return
  deleteReceipt(receiptId)
  const held: Held = {
    receipt,
    timer: setTimeout(() => {
      held.timer = null
      void deleteReceiptImage(receiptId)
    }, IMAGE_GRACE_MS),
  }
  stash.set(receiptId, held)
}

/**
 * Undo of an expense delete brings the receipt row back (and, within the window, its photo).
 * A late undo still restores the row, without the photo. Returns false when nothing was held.
 */
export function restoreExpenseReceipt(receiptId: string, addBack: (receipt: Receipt) => void): boolean {
  const held = stash.get(receiptId)
  if (!held) return false
  if (held.timer) clearTimeout(held.timer)
  stash.delete(receiptId)
  addBack(held.receipt)
  return true
}
