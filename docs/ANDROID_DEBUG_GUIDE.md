# Android Debug Guide — Buddget on S25 Ultra

## 1. Logcat in Android Studio

Logcat streams all native + WebView logs from the running device.

**Open Logcat:**
`View → Tool Windows → Logcat` (or `Alt+6`).

**Filter to Capacitor only** — paste one of these into the search box:

| Goal | Filter string |
|---|---|
| All Capacitor bridge traffic | `tag:Capacitor` |
| Plugin calls (SMS, Camera, SR) | `tag:Capacitor/Plugin` |
| Console logs from the WebView | `tag:chromium` |
| Bridge errors | `tag:Capacitor level:error` |

**Useful tags for this app:**

```
tag:Capacitor OR tag:SmsReceiver OR tag:SmsCapacitorPlugin
```

**Tip:** select "Verbose" from the level dropdown on the left when debugging; set to "Info" for normal runs.

---

## 2. Chrome Remote DevTools (WebView inspector)

This opens the full Chrome DevTools (Console, Network, Elements) for the live WebView running on the S25 Ultra.

### Setup (one-time)

1. On the S25 Ultra: `Settings → Developer Options → USB Debugging` must be ON.
2. Connect the phone via USB.
3. On the Mac, open a Chrome tab and navigate to:

```
chrome://inspect/#devices
```

4. Under **Remote Target** you should see `Buddget` (or `com.buddget.app`) listed.  
   If not, tap **Port forwarding** and confirm the USB connection is trusted on the phone.

### Using the inspector

- Click **inspect** next to the Buddget WebView entry.
- A full DevTools window opens — identical to debugging a desktop web app.

| Panel | What to check |
|---|---|
| **Console** | `console.log` from React, Capacitor plugin errors, any uncaught exceptions |
| **Network** | Verify `/api/receipt/scan`, `/api/voice/transcribe`, `/api/sms/parse` are hitting `https://buddget.app` (not `https://localhost`) and returning 200 |
| **Elements** | Inspect the DOM — confirm dropdown menus, modals, and z-index layers |
| **Sources** | Set breakpoints in the bundled JS to step through navigation or SMS logic |

### Filtering Network requests

In the Network panel, type `/api/` in the filter box to see only API calls. Check:
- **Status**: 200 = ok, 401 = auth not forwarded, 503 = env var missing on Vercel
- **Headers → Authorization**: should show `Bearer eyJ...` on Capacitor (bearer token from Supabase session)
- **Response**: inspect the JSON body for error messages

### Console tips

```js
// Paste in DevTools Console to read the Supabase session token live:
const { data } = await (await import('https://localhost/_next/static/chunks/...'))
// Easier: check Network → request headers for Authorization value
```

To filter noise, click the **Default levels** dropdown and uncheck Verbose/Info. Keep Warnings and Errors.

---

## 3. Rebuild cycle

After every JS/React change, run:

```bash
npm run cap:build        # Next.js export + cap sync
```

Then in Android Studio: **Build → Clean Project** → **Run** (▶).

Android Studio's Clean only wipes Gradle outputs — web assets in `android/app/src/main/assets/public/` are refreshed solely by `npm run cap:build`.
