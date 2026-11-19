import { DEFAULT_CASH_ID } from '@/lib/store/migrations/v17_uuid_remap'

/** The in-store Cash sentinel (and an empty id) is not a uuid: the server gets NULL instead. */
export function serverPaymentMethodId(id: string | null | undefined): string | null {
  return id && id !== DEFAULT_CASH_ID ? id : null
}
