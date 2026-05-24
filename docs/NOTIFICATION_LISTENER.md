# Android Notification Listener fallback

When SMS Retriever can't see bank messages (push-only banks, WhatsApp Pay,
Apple-Pay-on-Android relays), Buddget falls back to a custom Capacitor plugin
that hooks into `NotificationListenerService` and forwards each whitelisted
bank notification to `/api/sms/parse`.

The web side (`src/lib/native/notificationParser.ts`) is already implemented;
this doc covers the **Android Studio** plugin you need to paste into the
`android/` folder after `npx cap add android`. The folder is gitignored — the
human running the bootstrap is responsible for committing the plugin to their
fork or shipping it as part of the Play Store build.

> **Egypt-first whitelist** — see `BANK_PACKAGE_WHITELIST` in
> `src/lib/native/notificationParser.ts`. The list is Egyptian banks first,
> then UAE, then wider GCC. **Some package ids are best-known guesses** —
> verify the production identifier in Play Store before publishing the app.

---

## Plugin: `NotificationListener`

### `android/app/src/main/AndroidManifest.xml`

Inside `<application>`:

```xml
<service
  android:name=".notifications.BuddgetNotificationListener"
  android:label="Buddget Notification Listener"
  android:exported="false"
  android:permission="android.permission.BIND_NOTIFICATION_LISTENER_SERVICE">
  <intent-filter>
    <action android:name="android.service.notification.NotificationListenerService" />
  </intent-filter>
</service>
```

### `BuddgetNotificationListener.kt`

```kotlin
package online.buddget.notifications

import android.content.Intent
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import com.getcapacitor.JSObject
import org.json.JSONArray

class BuddgetNotificationListener : NotificationListenerService() {

  override fun onNotificationPosted(sbn: StatusBarNotification) {
    val pkg = sbn.packageName ?: return
    val whitelist = NotificationListenerPlugin.whitelist
    if (whitelist.isNotEmpty() && pkg !in whitelist) return

    val extras = sbn.notification?.extras ?: return
    val title = extras.getCharSequence("android.title")?.toString() ?: ""
    val text = extras.getCharSequence("android.text")?.toString()
      ?: extras.getCharSequence("android.bigText")?.toString() ?: ""

    if (text.isBlank()) return

    val payload = JSObject().apply {
      put("packageName", pkg)
      put("title", title)
      put("text", text)
    }
    NotificationListenerPlugin.dispatch(payload)
  }
}
```

### `NotificationListenerPlugin.kt`

```kotlin
package online.buddget.notifications

import android.content.ComponentName
import android.content.Intent
import android.provider.Settings
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "NotificationListener")
class NotificationListenerPlugin : Plugin() {

  companion object {
    @Volatile var whitelist: Set<String> = emptySet()
    private var instance: NotificationListenerPlugin? = null
    fun dispatch(payload: JSObject) {
      instance?.notifyListeners("onNotificationPosted", payload)
    }
  }

  override fun load() {
    instance = this
  }

  @PluginMethod
  fun start(call: PluginCall) {
    val packagesArg = call.getArray("packages")
    val list = mutableListOf<String>()
    packagesArg?.let {
      for (i in 0 until it.length()) list.add(it.getString(i) ?: continue)
    }
    whitelist = list.toSet()
    call.resolve()
  }

  @PluginMethod
  fun stop(call: PluginCall) {
    whitelist = emptySet()
    call.resolve()
  }

  @PluginMethod
  fun isEnabled(call: PluginCall) {
    val ctx = context.applicationContext
    val flat = Settings.Secure.getString(ctx.contentResolver, "enabled_notification_listeners")
    val cmp = ComponentName(ctx, BuddgetNotificationListener::class.java).flattenToString()
    val enabled = flat?.contains(cmp) == true
    val ret = JSObject()
    ret.put("enabled", enabled)
    call.resolve(ret)
  }

  @PluginMethod
  fun openSettings(call: PluginCall) {
    val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    context.startActivity(intent)
    call.resolve()
  }
}
```

### Register in `MainActivity.kt`

```kotlin
import online.buddget.notifications.NotificationListenerPlugin

class MainActivity : BridgeActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    registerPlugin(NotificationListenerPlugin::class.java)
    super.onCreate(savedInstanceState)
  }
}
```

## Calling from JS

Already wired:

```ts
import { startNotificationListener } from '@/lib/native/notificationParser'

// After biometric / email sign-in succeeds:
await startNotificationListener(session.access_token)
```

## Permission UX

Notification Listener requires the user to manually enable Buddget in
**Settings → Apps & notifications → Special access → Notification access**.
The plugin's `isEnabled()` lets you detect that and surface a one-tap
**Open Settings** CTA. Document this clearly on the SMS auto-tracking
landing card, especially for Egyptian users on Vodafone Egypt / Orange Egypt
where bank push notifications are increasingly common.

## Privacy

We forward only **bank** notifications (whitelisted packages) and only the
title/text. Never log raw payloads. Enable the listener as opt-in, not
default-on, and add a clear "What we read" disclosure in Settings.
