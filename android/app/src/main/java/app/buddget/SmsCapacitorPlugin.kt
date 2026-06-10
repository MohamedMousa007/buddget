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
     * Persists the Supabase access token + API base URL to SharedPreferences
     * so SmsReceiver can forward SMS via WorkManager even when the app is killed.
     */
    @PluginMethod
    fun saveToken(call: PluginCall) {
        val token  = call.getString("token")  ?: run { call.reject("token required"); return }
        val apiUrl = call.getString("apiUrl") ?: ""
        activity.getSharedPreferences("buddget_sms", Context.MODE_PRIVATE)
            .edit()
            .putString("access_token", token)
            .putString("api_url", apiUrl)
            .putBoolean("sms_enabled", true) // saving a token implies tracking is active
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
}
