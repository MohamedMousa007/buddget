import 'server-only'
import { getApps, initializeApp, cert, type App } from 'firebase-admin/app'
import { getMessaging, type Messaging } from 'firebase-admin/messaging'

let cached: { app: App; messaging: Messaging } | null = null

interface ServiceAccountJson {
  project_id?: string
  client_email?: string
  private_key?: string
}

function credentialsFromJson(): { projectId: string; clientEmail: string; privateKey: string } | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim()
  if (!raw) return null

  let parsed: ServiceAccountJson
  try {
    parsed = JSON.parse(raw) as ServiceAccountJson
  } catch (e) {
    console.error(
      '[firebaseAdmin] FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.',
      'First 200 chars:', raw.slice(0, 200),
      'Error:', e,
    )
    return null
  }

  const projectId = parsed.project_id
  const clientEmail = parsed.client_email
  // Handle both literal \n (escaped in JSON string) and real newlines
  const privateKey = parsed.private_key?.replace(/\\n/g, '\n')

  if (!projectId || !clientEmail || !privateKey) {
    console.error('[firebaseAdmin] service-account JSON missing project_id / client_email / private_key')
    return null
  }

  return { projectId, clientEmail, privateKey }
}

function credentialsFromEnvVars(): { projectId: string; clientEmail: string; privateKey: string } | null {
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim()
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim()
  // Raw PEM — no JSON encoding, no \\n escaping needed
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.trim().replace(/\\n/g, '\n')

  if (!projectId || !clientEmail || !privateKey) return null
  return { projectId, clientEmail, privateKey }
}

/**
 * Lazily initializes firebase-admin for FCM.
 *
 * Credential resolution order:
 *   1. FIREBASE_SERVICE_ACCOUNT_JSON (full JSON string)
 *   2. FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY (three separate vars — avoids JSON parse issues)
 *
 * Returns null when no credentials are available — callers treat this as
 * push delivery unavailable.
 */
export function getFirebaseAdmin(): { app: App; messaging: Messaging } | null {
  if (cached) return cached

  const creds = credentialsFromJson() ?? credentialsFromEnvVars()
  if (!creds) {
    console.error('[firebaseAdmin] no Firebase credentials found — set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY')
    return null
  }

  const { projectId, clientEmail, privateKey } = creds

  try {
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
    console.log('[firebaseAdmin] initialized for project', projectId)
    return cached
  } catch (e) {
    console.error('[firebaseAdmin] initializeApp failed — likely invalid private key format:', e)
    return null
  }
}
