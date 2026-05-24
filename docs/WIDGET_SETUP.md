# Buddget — Home-screen widgets (iOS WidgetKit + Android Glance)

The web layer pushes a JSON snapshot of the current month's spend into a shared
keystore (`Capacitor Preferences` → App Group on iOS, EncryptedSharedPreferences
on Android). The widget code below reads that snapshot and renders the home /
lock-screen widget without launching the WebView.

> **Egypt-first defaults** — sample data uses `EGP`. Switch the placeholder to
> `AED` / `SAR` / `QAR` / `KWD` / `OMR` / `BHD` per market when copying for QA.

---

## 1. JSON shape pushed by the web layer

`src/lib/native/widgetBridge.ts` writes this object under
`buddget.widget.snapshot.v1`:

```json
{
  "currency": "EGP",
  "spentThisMonth": 4350.5,
  "monthlyBudget": 12000,
  "topCategories": [
    { "category": "Food", "amount": 2100.5 },
    { "category": "Transport", "amount": 1200 },
    { "category": "Enjoyment", "amount": 1050 }
  ],
  "latestExpense": {
    "description": "Talabat — Otlob",
    "amount": 145,
    "currency": "EGP",
    "date": "2026-05-23"
  },
  "locale": "en-EG",
  "updatedAt": "2026-05-24T09:00:00Z"
}
```

## 2. iOS — WidgetKit (Swift)

Create the widget extension in Xcode after `npx cap add ios`:

1. Open `ios/App/App.xcworkspace`.
2. **File → New → Target → Widget Extension**, name `BuddgetWidget`.
3. In the main app target's **Signing & Capabilities** tab, add **App Groups**
   and create `group.online.buddget`. Repeat on the widget target.
4. Replace `BuddgetWidget.swift` with:

```swift
import WidgetKit
import SwiftUI

private let appGroup = "group.online.buddget"
private let key = "buddget.widget.snapshot.v1"

private struct Snapshot: Codable {
  struct CategoryRow: Codable { let category: String; let amount: Double }
  struct LatestExpense: Codable {
    let description: String
    let amount: Double
    let currency: String
    let date: String
  }
  let currency: String
  let spentThisMonth: Double
  let monthlyBudget: Double
  let topCategories: [CategoryRow]
  let latestExpense: LatestExpense?
  let locale: String
  let updatedAt: String
}

private func readSnapshot() -> Snapshot {
  let defaults = UserDefaults(suiteName: appGroup)
  guard
    let raw = defaults?.string(forKey: key),
    let data = raw.data(using: .utf8),
    let parsed = try? JSONDecoder().decode(Snapshot.self, from: data)
  else {
    return Snapshot(
      currency: "EGP",
      spentThisMonth: 0,
      monthlyBudget: 0,
      topCategories: [],
      latestExpense: nil,
      locale: "en-EG",
      updatedAt: ISO8601DateFormatter().string(from: Date())
    )
  }
  return parsed
}

struct BuddgetEntry: TimelineEntry {
  let date: Date
  let snapshot: Snapshot
}

struct Provider: TimelineProvider {
  func placeholder(in context: Context) -> BuddgetEntry {
    BuddgetEntry(date: Date(), snapshot: readSnapshot())
  }
  func getSnapshot(in context: Context, completion: @escaping (BuddgetEntry) -> Void) {
    completion(BuddgetEntry(date: Date(), snapshot: readSnapshot()))
  }
  func getTimeline(in context: Context, completion: @escaping (Timeline<BuddgetEntry>) -> Void) {
    let entry = BuddgetEntry(date: Date(), snapshot: readSnapshot())
    completion(Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(60 * 30))))
  }
}

struct BuddgetWidgetEntryView: View {
  var entry: Provider.Entry
  var body: some View {
    let s = entry.snapshot
    let progress = s.monthlyBudget > 0 ? min(s.spentThisMonth / s.monthlyBudget, 1) : 0
    VStack(alignment: .leading, spacing: 6) {
      Text("This month").font(.caption).foregroundColor(.secondary)
      Text(formatCurrency(s.spentThisMonth, code: s.currency))
        .font(.system(size: 22, weight: .bold))
      ProgressView(value: progress)
        .tint(.red)
      if let last = s.latestExpense {
        Text("\(last.description) · \(formatCurrency(last.amount, code: last.currency))")
          .font(.caption2).lineLimit(1)
      }
    }
    .padding(12)
    .containerBackground(.fill.tertiary, for: .widget)
  }

  private func formatCurrency(_ value: Double, code: String) -> String {
    let f = NumberFormatter()
    f.numberStyle = .currency
    f.currencyCode = code
    f.maximumFractionDigits = 0
    return f.string(from: NSNumber(value: value)) ?? "\(value) \(code)"
  }
}

@main
struct BuddgetWidget: Widget {
  let kind: String = "BuddgetWidget"
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: Provider()) { entry in
      BuddgetWidgetEntryView(entry: entry)
    }
    .configurationDisplayName("Buddget")
    .description("This month's spend, budget, and last expense.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}
```

5. In the widget target's Info.plist, ensure the App Group entry mirrors
   `group.online.buddget`.

## 3. Android — Glance widget (Kotlin)

After `npx cap add android`, in `android/app/`:

### 3.1 `build.gradle` — enable Compose + Glance

```gradle
android {
  buildFeatures { compose true }
  composeOptions { kotlinCompilerExtensionVersion '1.5.4' }
}

dependencies {
  implementation 'androidx.glance:glance:1.1.0'
  implementation 'androidx.glance:glance-appwidget:1.1.0'
  implementation 'androidx.glance:glance-material3:1.1.0'
  implementation 'androidx.compose.runtime:runtime:1.7.0'
  implementation 'org.jetbrains.kotlinx:kotlinx-serialization-json:1.6.3'
}
```

### 3.2 `BuddgetSnapshot.kt`

```kotlin
package online.buddget.widget

import kotlinx.serialization.Serializable

@Serializable
data class BuddgetSnapshot(
  val currency: String = "EGP",
  val spentThisMonth: Double = 0.0,
  val monthlyBudget: Double = 0.0,
  val topCategories: List<CategoryRow> = emptyList(),
  val latestExpense: LatestExpense? = null,
  val locale: String = "en-EG",
  val updatedAt: String = ""
) {
  @Serializable data class CategoryRow(val category: String, val amount: Double)
  @Serializable
  data class LatestExpense(
    val description: String,
    val amount: Double,
    val currency: String,
    val date: String
  )
}
```

### 3.3 `BuddgetWidget.kt` (Glance composable)

```kotlin
package online.buddget.widget

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.glance.GlanceModifier
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.linearProgressIndicator
import androidx.glance.layout.*
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import androidx.glance.color.ColorProvider
import androidx.compose.ui.graphics.Color
import androidx.glance.preferences.androidx.PreferencesGlanceStateDefinition
import kotlinx.serialization.json.Json

class BuddgetWidget : GlanceAppWidget() {
  override val stateDefinition = PreferencesGlanceStateDefinition

  override suspend fun provideGlance(context: Context, id: GlanceId) {
    val prefs = context.getSharedPreferences(
      "CapacitorStorage", Context.MODE_PRIVATE
    )
    val raw = prefs.getString("buddget.widget.snapshot.v1", null)
    val snapshot = if (raw != null) {
      runCatching { Json { ignoreUnknownKeys = true }.decodeFromString<BuddgetSnapshot>(raw) }
        .getOrDefault(BuddgetSnapshot())
    } else BuddgetSnapshot()

    provideContent {
      WidgetBody(snapshot)
    }
  }
}

@Composable
private fun WidgetBody(snapshot: BuddgetSnapshot) {
  val progress = if (snapshot.monthlyBudget > 0)
    (snapshot.spentThisMonth / snapshot.monthlyBudget).toFloat().coerceIn(0f, 1f) else 0f
  Column(
    modifier = GlanceModifier.fillMaxSize().padding(12.dp)
  ) {
    Text("This month", style = TextStyle(fontSize = 12.sp, color = ColorProvider(Color.Gray)))
    Text(
      formatAmount(snapshot.spentThisMonth, snapshot.currency),
      style = TextStyle(fontSize = 22.sp, fontWeight = FontWeight.Bold)
    )
    Spacer(modifier = GlanceModifier.height(6.dp))
    LinearProgressIndicator(
      progress = progress,
      color = ColorProvider(Color(0xFFE50914)),
      backgroundColor = ColorProvider(Color(0xFF2A2A38)),
      modifier = GlanceModifier.fillMaxWidth()
    )
    snapshot.latestExpense?.let { last ->
      Text(
        "${last.description} · ${formatAmount(last.amount, last.currency)}",
        style = TextStyle(fontSize = 11.sp, color = ColorProvider(Color.Gray))
      )
    }
  }
}

private fun formatAmount(value: Double, currency: String): String {
  val rounded = value.toLong()
  return "$currency $rounded"
}

class BuddgetWidgetReceiver : GlanceAppWidgetReceiver() {
  override val glanceAppWidget = BuddgetWidget()
}
```

### 3.4 `BuddgetWidgetUpdaterPlugin.kt`

The web layer calls `BuddgetWidgetUpdater.ping()` from
`src/lib/native/widgetBridge.ts`. Wire that JS bridge to a Capacitor plugin
that triggers `AppWidgetManager.updateAppWidget`:

```kotlin
package online.buddget.widget

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import androidx.glance.appwidget.GlanceAppWidgetManager
import kotlinx.coroutines.GlobalScope
import kotlinx.coroutines.launch

@CapacitorPlugin(name = "BuddgetWidgetUpdater")
class BuddgetWidgetUpdaterPlugin : Plugin() {
  @PluginMethod
  fun ping(call: PluginCall) {
    val ctx = context.applicationContext
    GlobalScope.launch {
      val manager = GlanceAppWidgetManager(ctx)
      val widget = BuddgetWidget()
      val ids = manager.getGlanceIds(widget.javaClass)
      ids.forEach { widget.update(ctx, it) }
    }
    call.resolve()
  }
}
```

Register the plugin in `MainActivity.kt`:

```kotlin
override fun onCreate(savedInstanceState: Bundle?) {
  registerPlugin(BuddgetWidgetUpdaterPlugin::class.java)
  super.onCreate(savedInstanceState)
}
```

### 3.5 `AndroidManifest.xml`

Inside `<application>`:

```xml
<receiver
  android:name=".widget.BuddgetWidgetReceiver"
  android:exported="false">
  <intent-filter>
    <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
  </intent-filter>
  <meta-data
    android:name="android.appwidget.provider"
    android:resource="@xml/buddget_widget_info" />
</receiver>
```

`android/app/src/main/res/xml/buddget_widget_info.xml`:

```xml
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
  android:initialLayout="@layout/glance_default_loading_layout"
  android:minWidth="120dp"
  android:minHeight="120dp"
  android:updatePeriodMillis="1800000"
  android:resizeMode="horizontal|vertical"
  android:widgetCategory="home_screen|keyguard" />
```

## 4. Updating from JS

`updateWidgetData()` in `src/lib/native/widgetBridge.ts` writes the JSON,
then calls `BuddgetWidgetUpdater.ping()` on Android. iOS reloads on its own
timeline (every 30 minutes by default, plus when the user opens the app).

Trigger it after every expense mutation — the included
`src/lib/native/WidgetSync.tsx` does this automatically by subscribing to the
finance store and pushing a debounced snapshot.

## 5. Sample preview values (Egypt-first)

When designing the SwiftUI preview / Glance preview, default to:

| Currency | Sample amount |
| -------- | ------------- |
| EGP      | 4,350         |
| AED      | 1,250         |
| SAR      | 1,300         |
| QAR      | 1,250         |
| KWD      | 110           |
| OMR      | 130           |
| BHD      | 130           |

Do **not** ship UAE-only sample art — Egypt is the primary market.
