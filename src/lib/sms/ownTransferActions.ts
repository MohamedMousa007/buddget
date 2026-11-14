import { apiFetchAuth } from '@/lib/apiBase'
import { deviceIdHeader } from '@/lib/native/deviceId'

export type OwnTransferAction = 'confirm' | 'decline' | 'undo'

/** Sends the user's answer on a possible own-account transfer to /api/sms/own-transfer. Resolves false on any failure. */
export async function answerOwnTransfer(parseLogId: string, action: OwnTransferAction): Promise<boolean> {
  try {
    const res = await apiFetchAuth('/api/sms/own-transfer', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(await deviceIdHeader()) },
      body: JSON.stringify({ parseLogId, action }),
    })
    return res.ok
  } catch {
    return false
  }
}
