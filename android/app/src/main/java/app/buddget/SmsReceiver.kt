package app.buddget

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.telephony.SmsMessage
import android.util.Log
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.OutOfQuotaPolicy
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

        // WorkManager is the SINGLE forwarding path — works whether the app is
        // open or killed, and the server dedup makes retries idempotent. The
        // user is notified by the server-side FCM push once parsing completes.
        val token  = prefs.getString("access_token", null)
        val apiUrl = prefs.getString("api_url", null)

        if (token != null && apiUrl != null) {
            val data = workDataOf(
                SmsForwardWorker.KEY_MESSAGE  to fullBody,
                SmsForwardWorker.KEY_SENDER   to (sender ?: ""),
                SmsForwardWorker.KEY_TOKEN    to token,
                SmsForwardWorker.KEY_API_URL  to apiUrl,
            )
            WorkManager.getInstance(context).enqueue(
                OneTimeWorkRequestBuilder<SmsForwardWorker>()
                    .setInputData(data)
                    // Android 12+: start the POST immediately instead of waiting
                    // for batch scheduling; older devices fall back to a normal
                    // request (no foreground requirements with this policy).
                    .setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST)
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
    }

    /**
     * Broad keyword filter applied before queuing the WorkManager job.
     * Keeps personal SMS off the API entirely. Custom keywords are persisted
     * from the JS store (setKeywords) so the killed-app path matches the same
     * SMS the user configured in Settings.
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
}
