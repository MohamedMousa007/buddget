package app.buddget

import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback

@CapacitorPlugin(
    name = "SmsCapacitorPlugin",
    permissions = [
        Permission(
            strings = ["android.permission.RECEIVE_SMS"],
            alias = "sms"
        )
    ]
)
class SmsCapacitorPlugin : Plugin() {

    @PluginMethod
    fun checkPermission(call: PluginCall) {
        val granted = getPermissionState("sms")?.name == "GRANTED"
        call.resolve(JSObject().apply { put("granted", granted) })
    }

    @PluginMethod
    fun requestPermission(call: PluginCall) {
        if (getPermissionState("sms")?.name == "GRANTED") {
            call.resolve(JSObject().apply { put("granted", true) })
            return
        }
        requestPermissionForAlias("sms", call, "smsPermissionCallback")
    }

    @PermissionCallback
    private fun smsPermissionCallback(call: PluginCall) {
        val granted = getPermissionState("sms")?.name == "GRANTED"
        call.resolve(JSObject().apply { put("granted", granted) })
    }

    /**
     * Persists the non-expiring sms_ingest_token + API base URL to
     * SharedPreferences so SmsReceiver can forward SMS via WorkManager even
     * when the app is killed. Deliberately does NOT touch sms_enabled —
     * setEnabled is the single gate, so a background token refresh can never
     * re-enable tracking the user turned off.
     */
    @PluginMethod
    fun saveToken(call: PluginCall) {
        val token  = call.getString("token")  ?: run { call.reject("token required"); return }
        val apiUrl = call.getString("apiUrl") ?: ""
        val userId = call.getString("userId") ?: ""
        if (!SmsApiUrl.isAllowed(apiUrl, SmsStore.isDebuggable(activity))) { call.reject("apiUrl not allowed"); return }
        SmsStore.prefs(activity)
            .edit()
            .putString("access_token", token)
            .putString("api_url", apiUrl)
            // Owner-stamp the token so an account switch can detect + drop a token
            // that belongs to the previous user before SmsReceiver forwards with it.
            .putString("token_user_id", userId)
            // Device capability marker: once armed, the device stays "wired" across sign-out / account switches.
            .putBoolean("armed_once", true)
            .apply()
        SmsStore.clearNeedsResync(activity)
        call.resolve()
    }

    /** Gates the native SmsReceiver. When false, all incoming SMS are ignored. */
    @PluginMethod
    fun setEnabled(call: PluginCall) {
        val enabled = call.getBoolean("enabled") ?: false
        SmsStore.prefs(activity)
            .edit()
            .putBoolean("sms_enabled", enabled)
            .apply()
        call.resolve()
    }

    /**
     * Per-device tracking state — authoritative for the UI (the server setting is
     * only cross-device intent). On a fresh install nothing is set ⇒ all false.
     * setupCompleted == tokenSaved on Android (no setup guide; arming = saving a token).
     */
    @PluginMethod
    fun getStatus(call: PluginCall) {
        val prefs = SmsStore.prefs(activity)
        val tokenSaved = prefs.getString("access_token", null) != null
        val enabled = prefs.getBoolean("sms_enabled", false)
        val permission = getPermissionState("sms")?.name == "GRANTED"
        val lastRunAt = prefs.getString("last_run_at", "") ?: ""
        call.resolve(JSObject().apply {
            put("tokenSaved", tokenSaved)
            put("needsResync", SmsStore.needsResync(activity))
            put("enabled", enabled)
            put("setupCompleted", tokenSaved)
            // Device capability: a receiver is armed here (token saved) or has fired.
            // Survives account switches (clearCredentials keeps last_run_at).
            put("wired", tokenSaved || lastRunAt.isNotEmpty() || prefs.getBoolean("armed_once", false))
            put("tokenUserId", prefs.getString("token_user_id", "") ?: "")
            put("permission", permission)
            put("lastRunAt", lastRunAt)
            put("lastResult", prefs.getString("last_result", "") ?: "")
            put("pendingCount", PendingSmsQueue.count(activity))
            put("evictedCount", PendingSmsQueue.evictedCount(activity))
            PendingSmsQueue.oldestReceivedAt(activity).takeIf { it.isNotEmpty() }?.let { put("oldestPendingAt", it) }
        })
    }

    /** Returns queued SMS without clearing — feeds the in-app "waiting to sync" cards. */
    @PluginMethod
    fun peekPendingQueue(call: PluginCall) {
        val items = PendingSmsQueue.peek(activity)
        call.resolve(JSObject().apply { put("items", org.json.JSONArray(items.toString())) })
    }

    /** Removes items the server confirmed (or permanently rejected) during a drain. */
    @PluginMethod
    fun removePending(call: PluginCall) {
        val items = call.getArray("items") ?: run { call.resolve(); return }
        val arr = org.json.JSONArray(items.toString())
        for (i in 0 until arr.length()) {
            val item = arr.getJSONObject(i)
            PendingSmsQueue.remove(activity, item.optString("message"), item.optString("receivedAt"), item.optString("eventId"))
        }
        call.resolve()
    }

    /** Phase-1/2 forwarding mode: "sender" (business-sender) or "keyword" (legacy). */
    @PluginMethod
    fun setForwardMode(call: PluginCall) {
        val mode = call.getString("mode") ?: "sender"
        SmsStore.prefs(activity)
            .edit()
            .putString("sms_forward_mode", mode)
            .apply()
        call.resolve()
    }

    /**
     * Account switch: drop the stored token/owner + disarm, but KEEP last_run_at
     * and the pending queue. The receiver still exists on this device (so the UI
     * keeps the switch, not the setup CTA), and the previous account's queued SMS
     * wait for that user to return rather than being forwarded into the new one.
     */
    @PluginMethod
    fun clearCredentials(call: PluginCall) {
        SmsStore.prefs(activity)
            .edit()
            .remove("access_token")
            .remove("api_url")
            .remove("token_user_id")
            .putBoolean("sms_enabled", false)
            .apply()
        call.resolve()
    }

    /** Trusted-device secret, kept in the same encrypted store as the ingest token. clearCredentials and clearState leave it alone. */
    @PluginMethod
    fun setDeviceSecret(call: PluginCall) {
        val secret = call.getString("secret") ?: run { call.reject("secret required"); return }
        SmsStore.prefs(activity).edit().putString("device_secret", secret).apply()
        call.resolve()
    }

    @PluginMethod
    fun getDeviceSecret(call: PluginCall) {
        val secret = SmsStore.prefs(activity).getString("device_secret", null)
        call.resolve(JSObject().apply { put("secret", secret ?: org.json.JSONObject.NULL) })
    }

    @PluginMethod
    fun removeDeviceSecret(call: PluginCall) {
        SmsStore.prefs(activity).edit().remove("device_secret").apply()
        call.resolve()
    }

    /** Full device wipe (forget device): also clears the queue + owner. */
    @PluginMethod
    fun clearState(call: PluginCall) {
        SmsStore.prefs(activity)
            .edit()
            .remove("access_token")
            .remove("api_url")
            .remove("token_user_id")
            .remove("armed_once")
            .remove("pending_queue")
            .putBoolean("sms_enabled", false)
            .apply()
        call.resolve()
    }
}
