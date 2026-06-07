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

  const file = await dataUrlToFile(dataUrl, `receipt-${Date.now()}.${photo.format ?? 'jpg'}`)
  return { file, dataUrl }
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

    const cleanup = () => {
      input.removeEventListener('change', onChange)
      document.body.removeChild(input)
    }

    const onChange = async () => {
      const file = input.files?.[0]
      if (!file) {
        cleanup()
        reject(new Error('No image selected'))
        return
      }
      try {
        const dataUrl = await fileToDataUrl(file)
        cleanup()
        resolve({ file, dataUrl })
      } catch (err) {
        cleanup()
        reject(err)
      }
    }

    input.addEventListener('change', onChange)
    document.body.appendChild(input)
    input.click()
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
