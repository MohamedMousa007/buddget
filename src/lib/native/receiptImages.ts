/**
 * Local-only receipt photo storage (Capacitor Filesystem, Directory.Data).
 * Images never leave the device — the DB stores only the parsed breakdown.
 * Files older than RETENTION_DAYS are deleted on app boot.
 */
import { isNative } from '@/lib/native/isNative'

const DIR = 'receipts'
const RETENTION_DAYS = 60

async function fs() {
  const { Filesystem, Directory } = await import('@capacitor/filesystem')
  return { Filesystem, Directory }
}

/** Persists a captured receipt photo (dataUrl) as receipts/<receiptId>.jpg. Native only. */
export async function saveReceiptImage(receiptId: string, dataUrl: string): Promise<void> {
  if (!isNative()) return
  try {
    const { Filesystem, Directory } = await fs()
    const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
    await Filesystem.writeFile({
      path: `${DIR}/${receiptId}.jpg`,
      data: base64,
      directory: Directory.Data,
      recursive: true,
    })
  } catch (e) {
    console.error('[receiptImages] save failed', e)
  }
}

/** Returns the stored photo as a data URL, or null when absent (or on web). */
export async function readReceiptImage(receiptId: string): Promise<string | null> {
  if (!isNative()) return null
  try {
    const { Filesystem, Directory } = await fs()
    const { data } = await Filesystem.readFile({
      path: `${DIR}/${receiptId}.jpg`,
      directory: Directory.Data,
    })
    return typeof data === 'string' ? `data:image/jpeg;base64,${data}` : null
  } catch {
    return null
  }
}

/** Deletes stored receipt photos older than the retention window. Errors swallowed. */
export async function cleanupOldReceiptImages(maxAgeDays = RETENTION_DAYS): Promise<void> {
  if (!isNative()) return
  try {
    const { Filesystem, Directory } = await fs()
    const { files } = await Filesystem.readdir({ path: DIR, directory: Directory.Data })
    const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000
    for (const f of files) {
      if (f.mtime < cutoff) {
        await Filesystem.deleteFile({ path: `${DIR}/${f.name}`, directory: Directory.Data })
          .catch(() => {})
      }
    }
  } catch {
    // directory doesn't exist yet — nothing to clean
  }
}
