package app.buddget

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log

/**
 * Fires on device reboot. The static `SMS_RECEIVED` receiver already survives a
 * reboot once the app has launched and SMS permission is granted; this receiver
 * primarily satisfies aggressive-OEM autostart (moving the app out of the
 * "stopped" state) and warms the instant-notification channel so the first
 * post-reboot bank SMS renders immediately.
 */
class BootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        try {
            val action = intent.action ?: return
            if (action != Intent.ACTION_BOOT_COMPLETED &&
                action != "android.intent.action.QUICKBOOT_POWERON"
            ) return

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val channel = NotificationChannel(
                    SmsReceiver.CHANNEL_ID, "Bank Transactions",
                    NotificationManager.IMPORTANCE_HIGH,
                ).apply { description = "Instant bank SMS alerts" }
                (context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager)
                    .createNotificationChannel(channel)
            }
        } catch (t: Throwable) {
            Log.e("BootReceiver", "onReceive failed", t)
        }
    }
}
