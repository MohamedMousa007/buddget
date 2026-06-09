package app.buddget

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * Fires on device reboot. The static `SMS_RECEIVED` receiver already survives a
 * reboot once the app has launched and SMS permission is granted; this receiver
 * satisfies aggressive-OEM autostart by moving the app out of the "stopped"
 * state so SmsReceiver keeps firing post-reboot.
 */
class BootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        try {
            val action = intent.action ?: return
            if (action != Intent.ACTION_BOOT_COMPLETED &&
                action != "android.intent.action.QUICKBOOT_POWERON"
            ) return
            Log.i("BootReceiver", "boot completed — SMS receiver armed")
        } catch (t: Throwable) {
            Log.e("BootReceiver", "onReceive failed", t)
        }
    }
}
