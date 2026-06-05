import { NextResponse, type NextRequest } from 'next/server'

/** WebView origins used by Capacitor iOS / Android shells. */
const CAPACITOR_ORIGINS = new Set([
  'https://localhost',
  'capacitor://localhost',
  'http://localhost:3000',
])

export function isCapacitorApiOrigin(origin: string | null): boolean {
  return Boolean(origin && CAPACITOR_ORIGINS.has(origin))
}

/** Attach CORS headers so the native WebView can call `/api/*` on buddget.app. */
export function withNativeApiCors(request: NextRequest, response: NextResponse): NextResponse {
  const origin = request.headers.get('origin')
  if (!isCapacitorApiOrigin(origin)) return response
  response.headers.set('Access-Control-Allow-Origin', origin!)
  response.headers.set('Access-Control-Allow-Credentials', 'true')
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS')
  response.headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Buddget-Device-Id',
  )
  response.headers.append('Vary', 'Origin')
  return response
}

export function nativeApiPreflightResponse(request: NextRequest): NextResponse | null {
  if (request.method !== 'OPTIONS') return null
  const origin = request.headers.get('origin')
  if (!isCapacitorApiOrigin(origin)) return null
  return withNativeApiCors(request, new NextResponse(null, { status: 204 }))
}
