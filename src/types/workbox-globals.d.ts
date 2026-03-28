/** next-pwa `register.js` attaches `window.workbox` (workbox-window Workbox instance). */
type WorkboxWindowInstance = {
  addEventListener(type: 'waiting', listener: () => void): void
  removeEventListener(type: 'waiting', listener: () => void): void
  messageSkipWaiting(): void
}

declare global {
  interface Window {
    workbox?: WorkboxWindowInstance
  }
}

export {}
