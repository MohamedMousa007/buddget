package app.buddget

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.telephony.SmsMessage
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkRequest
import androidx.work.workDataOf
import java.util.concurrent.TimeUnit

class SmsReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        // Wrap everything: a malformed PDU or low-memory throw must never crash the process.
        try {
            handleSms(context, intent)
        } catch (t: Throwable) {
            Log.e("SmsReceiver", "onReceive failed", t)
        }
    }

    private fun handleSms(context: Context, intent: Intent) {
        if (intent.action != "android.provider.Telephony.SMS_RECEIVED") return

        // ── Enable gate: when tracking is OFF the receiver does nothing. ───────
        // Default false ⇒ users who never enabled tracking get no notifications.
        // Enabled users get the flag set on next app open via startSMSTracking → saveToken.
        val prefs = context.getSharedPreferences("buddget_sms", Context.MODE_PRIVATE)
        if (!prefs.getBoolean("sms_enabled", false)) return

        val bundle = intent.extras ?: return
        @Suppress("DEPRECATION")
        val pdus = bundle.get("pdus") as? Array<*> ?: return
        val format = bundle.getString("format")

        val messages = pdus.mapNotNull { pdu ->
            if (pdu !is ByteArray) null
            else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
                SmsMessage.createFromPdu(pdu, format)
            else
                @Suppress("DEPRECATION")
                SmsMessage.createFromPdu(pdu)
        }

        val fullBody = messages.joinToString("") { it.messageBody ?: "" }.trim()
        val sender   = messages.firstOrNull()?.originatingAddress

        val customKeywords = prefs.getString("custom_keywords", "")
            ?.split(",")?.map { it.trim() }?.filter { it.isNotEmpty() } ?: emptyList()

        if (fullBody.isEmpty() || !isBankishMessage(fullBody, customKeywords)) return

        // Post instant notification before any network call (~0–50 ms after SMS arrives).
        val notifId = BASE_NOTIF_ID + (fullBody.hashCode() and 0x7FFFFFFF) % 1000
        postInstantNotification(context, fullBody, notifId)

        // ── Layer A: WorkManager (background-safe, survives app kill) ──────────
        val token  = prefs.getString("access_token", null)
        val apiUrl = prefs.getString("api_url", null)

        if (token != null && apiUrl != null) {
            val data = workDataOf(
                SmsForwardWorker.KEY_MESSAGE  to fullBody,
                SmsForwardWorker.KEY_SENDER   to (sender ?: ""),
                SmsForwardWorker.KEY_TOKEN    to token,
                SmsForwardWorker.KEY_API_URL  to apiUrl,
                SmsForwardWorker.KEY_NOTIF_ID to notifId,
            )
            WorkManager.getInstance(context).enqueue(
                OneTimeWorkRequestBuilder<SmsForwardWorker>()
                    .setInputData(data)
                    .setConstraints(
                        Constraints.Builder()
                            .setRequiredNetworkType(NetworkType.CONNECTED)
                            .build()
                    )
                    .setBackoffCriteria(
                        BackoffPolicy.EXPONENTIAL,
                        WorkRequest.MIN_BACKOFF_MILLIS,
                        TimeUnit.MILLISECONDS,
                    )
                    .build()
            )
        }

        // ── Layer B: JS listener (real-time UI refresh when app is open) ───────
        // SmsCapacitorPlugin.onSmsReceived is a no-op if instance is null (app killed).
        SmsCapacitorPlugin.onSmsReceived(fullBody, sender)
    }

    private fun createChannelIfNeeded(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID, "Bank Transactions",
                NotificationManager.IMPORTANCE_HIGH,
            ).apply { description = "Instant bank SMS alerts" }
            (context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager)
                .createNotificationChannel(channel)
        }
    }

    private fun extractAmount(text: String): String? =
        Regex("""(?i)egp\s*([\d,]+\.?\d*)""").find(text)?.groupValues?.get(1)

    private fun postInstantNotification(context: Context, body: String, notifId: Int) {
        createChannelIfNeeded(context)
        val amount = extractAmount(body)
        val title = if (amount != null) "Bank Transaction: EGP $amount" else "Bank Transaction Detected"
        val notif = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText("Processing details…")
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .build()
        (context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager)
            .notify(notifId, notif)
    }

    /**
     * Broad keyword filter applied before queuing the WorkManager job.
     * Keeps personal SMS off the API entirely. Custom keywords are persisted
     * from the JS store (setKeywords) so the killed-app path matches the same
     * SMS as the in-app JS listener.
     */
    private fun isBankishMessage(text: String, customKeywords: List<String>): Boolean {
        val lower = text.lowercase()
        val englishKeywords = listOf(
            "egp", "aed", "sar", "qar", "kwd", "omr", "bhd",
            "debited", "credited", "spent at", "purchase of",
            "transaction of", "withdrawn", "inward transfer",
            "deposit", "instapay", "vodafone cash", "fawry",
        )
        val arabicKeywords = listOf(
            "جنيه", "تم خصم", "تم سحب", "تم دفع",
            "عملية شراء", "تم إيداع", "تم إضافة",
        )
        return englishKeywords.any { lower.contains(it) } ||
               arabicKeywords.any { text.contains(it) } ||
               customKeywords.any { lower.contains(it.lowercase()) }
    }

    companion object {
        const val CHANNEL_ID    = "sms_instant"
        const val BASE_NOTIF_ID = 9001
    }
}
