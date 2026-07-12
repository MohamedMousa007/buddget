'use client'

import { registerPlugin } from '@capacitor/core'
import { isNative, isAndroid } from '@/lib/native/isNative'

/**
 * Native document scanner — iOS VisionKit (`VNDocumentCameraViewController`) and
 * Android ML Kit (`GmsDocumentScanner`). Both give auto edge-detection,
 * perspective correction, manual crop, and multi-page capture for free.
 */
export interface DocumentScannerPlugin {
  /**
   * Opens the native scanner. Returns base64-encoded JPEGs (no `data:` prefix),
   * one per captured page. Rejects with `"cancelled"` if the user backs out,
   * or `"unsupported"` when the platform can't scan (e.g. iOS gallery source).
   */
  scan(options: { source?: 'camera' | 'gallery'; pageLimit?: number }): Promise<{ images: string[] }>
  /** Android: whether the ML Kit scanner module is installed/available. iOS: VisionKit support. */
  isAvailable(): Promise<{ available: boolean }>
}

const DocumentScanner = registerPlugin<DocumentScannerPlugin>('DocumentScanner')

/** True when the native scanner can be used. False on web so callers fall back. */
export async function isDocumentScannerAvailable(): Promise<boolean> {
  if (!isNative()) return false
  try {
    const { available } = await DocumentScanner.isAvailable()
    return available
  } catch {
    return false
  }
}

/**
 * Runs the native scanner and returns base64 JPEG pages. Throws `'cancelled'`
 * or `'unsupported'` (string messages) that the caller maps to its own flow.
 */
export async function scanDocumentPages(
  source: 'camera' | 'gallery',
  pageLimit = 5,
): Promise<string[]> {
  // Android's ML Kit UI handles both camera and gallery; iOS VisionKit is camera-only.
  const { images } = await DocumentScanner.scan({ source, pageLimit })
  return images
}

/** iOS VisionKit has no gallery mode, so a gallery request must fall back. */
export function scannerSupportsGallery(): boolean {
  return isAndroid()
}
