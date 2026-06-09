import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Capacitor 8 config for the Buddget native app.
 *
 * Web layer is built as a static export from Next.js (`out/`) and shipped
 * inside the iOS/Android binaries. All API calls (`/api/*`) are made via
 * `NEXT_PUBLIC_API_BASE_URL` to the deployed origin (e.g. https://buddget.app).
 *
 * Run after pulling: `npx cap add android` / `npx cap add ios`
 * — see `docs/CAPACITOR_BOOTSTRAP.md`.
 */
const config: CapacitorConfig = {
  appId: 'app.buddget',
  appName: 'Buddget',
  webDir: 'out',
  server: {
    /** allowNavigation lets the WebView talk to the production API origin. */
    allowNavigation: ['buddget.app', '*.buddget.app'],
    androidScheme: 'https',
    iosScheme: 'https',
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: process.env.NODE_ENV !== 'production',
  },
  ios: {
    contentInset: 'always',
    scrollEnabled: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: '#0A0A0F',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0A0A0F',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_buddget',
      iconColor: '#E50914',
    },
    Camera: {
      androidScaleType: 'CENTER_CROP',
    },
    Preferences: {
      group: 'group.app.buddget',
    },
    SpeechRecognition: {
      // Plugin reads at runtime; no static config required.
    },
    BiometricAuth: {
      // Reason / fallback strings handled per-call from the JS layer.
    },
  },
}

export default config
