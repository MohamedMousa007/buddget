'use client'

import { isNative } from '@/lib/native/isNative'

export interface CapturedImage {
  /** Browser-native File suitable for FormData. */
  file: File
  /** Same data as a `data:` URL (used for preview). */
  dataUrl: string
}

/**
 * Captures a single receipt image. Prefers the Capacitor Camera plugin (true
 * native camera, edge-detect on Android, document mode on iOS); falls back to
 * a hidden `<input type="file" capture="environment">` on the web.
 */
/** Legacy helper — uses camera on native, file input on web. */
export async function captureReceiptPhoto(): Promise<CapturedImage> {
  return capturePhoto('camera')
}

/** Capture from a specific source — 'camera' or 'gallery'. */
export async function capturePhoto(source: 'camera' | 'gallery'): Promise<CapturedImage> {
  if (isNative()) return captureNative(source)
  return captureWeb()
}

async function captureNative(source: 'camera' | 'gallery'): Promise<CapturedImage> {
  const cam = await import('@capacitor/camera')
  const { Camera, CameraResultType, CameraSource } = cam

  // Explicit permission request before accessing hardware — avoids silent failure.
  const permCheck = await Camera.checkPermissions()
  if (permCheck.camera !== 'granted') {
    const req = await Camera.requestPermissions({ permissions: ['camera'] })
    if (req.camera !== 'granted') {
      throw new Error(
        'Camera access denied. Please go to Settings → Apps → Buddget → Permissions and enable Camera.'
      )
    }
  }

  const photo = await Camera.getPhoto({
    quality: 80,
    allowEditing: false,
    resultType: CameraResultType.DataUrl,
    source: source === 'camera' ? CameraSource.Camera : CameraSource.Photos,
    correctOrientation: true,
    saveToGallery: false,
  })

  const dataUrl = photo.dataUrl
  if (!dataUrl) throw new Error('Camera returned no image')

  return downscaleCaptured(dataUrl, `receipt-${Date.now()}.jpg`)
}

async function captureWeb(): Promise<CapturedImage> {
  if (typeof document === 'undefined') {
    throw new Error('Receipt scan is only available in the browser or app')
  }

  return await new Promise<CapturedImage>((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.capture = 'environment'
    input.style.position = 'fixed'
    input.style.left = '-9999px'

    // Mutable ref so onChange and onCancel can share a cleanup without forward-ref TS errors.
    let detach = () => {}
    const onChange = async () => {
      const file = input.files?.[0]
      if (!file) { detach(); reject(new Error('No image selected')); return }
      try {
        const dataUrl = await fileToDataUrl(file)
        detach()
        resolve(await downscaleCaptured(dataUrl, `receipt-${Date.now()}.jpg`))
      } catch (err) { detach(); reject(err) }
    }
    const onCancel = () => { detach(); reject(new Error('No image selected')) }
    detach = () => {
      input.removeEventListener('change', onChange)
      input.removeEventListener('cancel', onCancel)
      if (input.parentNode) document.body.removeChild(input)
    }

    input.addEventListener('change', onChange)
    input.addEventListener('cancel', onCancel)
    document.body.appendChild(input)
    input.click()
  })
}

const MAX_EDGE = 1600
const JPEG_QUALITY = 0.8

/**
 * Downscales a captured image to a JPEG with its longest edge ≤ {@link MAX_EDGE}.
 * Normalizes large photos and HEIC/PNG captures into a small, Gemini-friendly JPEG
 * (keeps payloads well under the 10 MB cap and improves OCR reliability).
 * Falls back to the original data URL if canvas decoding fails.
 */
async function downscaleCaptured(dataUrl: string, filename: string): Promise<CapturedImage> {
  try {
    const img = await loadImage(dataUrl)
    const longest = Math.max(img.naturalWidth, img.naturalHeight)
    const scale = longest > MAX_EDGE ? MAX_EDGE / longest : 1
    const width = Math.round(img.naturalWidth * scale)
    const height = Math.round(img.naturalHeight * scale)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('no 2d context')
    ctx.drawImage(img, 0, 0, width, height)

    const jpegUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
    const file = await dataUrlToFile(jpegUrl, filename)
    return { file, dataUrl: jpegUrl }
  } catch {
    const file = await dataUrlToFile(dataUrl, filename)
    return { file, dataUrl }
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to decode image'))
    img.src = src
  })
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

async function dataUrlToFile(dataUrl: string, filename: string): Promise<File> {
  const res = await fetch(dataUrl)
  const blob = await res.blob()
  return new File([blob], filename, { type: blob.type || 'image/jpeg' })
}
