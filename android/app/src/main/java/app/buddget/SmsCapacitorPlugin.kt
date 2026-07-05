package app.buddget

import android.content.Context
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
            strings = ["android.permission.RECEIVE_SMS", "android.permission.READ_SMS"],
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
        activity.getSharedPreferences("buddget_sms", Context.MODE_PRIVATE)
            .edit()
            .putString("access_token", token)
            .putString("api_url", apiUrl)
            .apply()
        call.resolve()
    }

    /** Gates the native SmsReceiver. When false, all incoming SMS are ignored. */
    @PluginMethod
    fun setEnabled(call: PluginCall) {
        val enabled = call.getBoolean("enabled") ?: false
        activity.getSharedPreferences("buddget_sms", Context.MODE_PRIVATE)
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
        val prefs = activity.getSharedPreferences("buddget_sms", Context.MODE_PRIVATE)
        val tokenSaved = prefs.getString("access_token", null) != null
        val enabled = prefs.getBoolean("sms_enabled", false)
        val permission = getPermissionState("sms")?.name == "GRANTED"
        call.resolve(JSObject().apply {
            put("tokenSaved", tokenSaved)
            put("enabled", enabled)
            put("setupCompleted", tokenSaved)
            put("permission", permission)
            put("lastRunAt", prefs.getString("last_run_at", "") ?: "")
            put("lastResult", prefs.getString("last_result", "") ?: "")
            put("pendingCount", PendingSmsQueue.count(activity))
        })
    }

    /** Returns queued SMS without clearing — feeds the in-app "waiting to sync" cards. */
    @PluginMethod
    fun peekPendingQueue(call: PluginCall) {
        val items = PendingSmsQueue.peek(activity)
        call.resolve(JSObject().apply { put("items", org.json.JSONArray(items.toString())) })
    }

    /** Returns and clears all SMS the worker could not deliver (offline / bad token). */
    @PluginMethod
    fun drainPendingQueue(call: PluginCall) {
        val items = PendingSmsQueue.drain(activity)
        call.resolve(JSObject().apply { put("items", org.json.JSONArray(items.toString())) })
    }

    /** Re-appends items whose JS-side replay failed so they survive to the next drain. */
    @PluginMethod
    fun requeuePending(call: PluginCall) {
        val items = call.getArray("items") ?: run { call.resolve(); return }
        PendingSmsQueue.requeue(activity, org.json.JSONArray(items.toString()))
        call.resolve()
    }

    /** Phase-1/2 forwarding mode: "sender" (business-sender) or "keyword" (legacy). */
    @PluginMethod
    fun setForwardMode(call: PluginCall) {
        val mode = call.getString("mode") ?: "sender"
        activity.getSharedPreferences("buddget_sms", Context.MODE_PRIVATE)
            .edit()
            .putString("sms_forward_mode", mode)
            .apply()
        call.resolve()
    }

    /** Sign-out / account switch: wipe per-device SMS state so the next user starts OFF. */
    @PluginMethod
    fun clearState(call: PluginCall) {
        activity.getSharedPreferences("buddget_sms", Context.MODE_PRIVATE)
            .edit()
            .remove("access_token")
            .remove("api_url")
            .remove("pending_queue")
            .putBoolean("sms_enabled", false)
            .apply()
        call.resolve()
    }
}
