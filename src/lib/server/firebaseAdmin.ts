import 'server-only'
import { getApps, initializeApp, cert, type App } from 'firebase-admin/app'
import { getMessaging, type Messaging } from 'firebase-admin/messaging'

let cached: { app: App; messaging: Messaging } | null = null

interface ServiceAccountJson {
  project_id?: string
  client_email?: string
  private_key?: string
}

/**
 * Lazily initializes firebase-admin for FCM. Reads `FIREBASE_SERVICE_ACCOUNT_JSON`
 * (raw JSON string, escaped newlines OK). Returns `null` when env is missing —
 * callers must surface a 503 in that case.
 */
export function getFirebaseAdmin(): { app: App; messaging: Messaging } | null {
  if (cached) return cached

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim()
  if (!raw) return null

  let parsed: ServiceAccountJson
  try {
    parsed = JSON.parse(raw) as ServiceAccountJson
  } catch (e) {
    console.error('[firebaseAdmin] FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON', e)
    return null
  }

  const projectId = parsed.project_id
  const clientEmail = parsed.client_email
  const privateKey = parsed.private_key?.replace(/\\n/g, '\n')

  if (!projectId || !clientEmail || !privateKey) {
    console.error('[firebaseAdmin] service-account JSON is missing required keys')
    return null
  }

  const existing = getApps().find((a) => a.name === 'buddget-fcm')
  const app =
    existing ??
    initializeApp(
      {
        credential: cert({ projectId, clientEmail, privateKey }),
        projectId,
      },
      'buddget-fcm',
    )

  cached = { app, messaging: getMessaging(app) }
  return cached
}
