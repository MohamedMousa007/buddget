export async function requestPushPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const result = await Notification.requestPermission()
  return result === 'granted'
}

export async function showLocalNotification(
  title: string,
  body: string,
  icon = '/icons/icon-192.png'
): Promise<void> {
  if (Notification.permission !== 'granted') return
  if ('serviceWorker' in navigator) {
    const reg = await navigator.serviceWorker.getRegistration()
    if (reg) {
      await reg.showNotification(title, { body, icon, badge: '/icons/icon-32.png' })
      return
    }
  }
  new Notification(title, { body, icon })
}

// TODO: Replace with FCM token registration when
// connecting to Google Play TWA or Apple wrapper
