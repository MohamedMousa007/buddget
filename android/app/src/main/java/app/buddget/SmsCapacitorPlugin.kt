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

    companion object {
        private var instance: SmsCapacitorPlugin? = null

        /** Called by SmsReceiver from the BroadcastReceiver context. */
        fun onSmsReceived(messageBody: String, sender: String?) {
            val plugin = instance ?: return
            val data = JSObject().apply {
                put("message", messageBody)
                put("sender", sender ?: "")
            }
            plugin.notifyListeners("onSmsReceive", data)
        }
    }

    override fun load() {
        instance = this
    }

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
            .apply()
        call.resolve()
    }
}
