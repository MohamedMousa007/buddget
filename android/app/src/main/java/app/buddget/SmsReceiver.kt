package app.buddget

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.telephony.SmsMessage
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
        if (intent.action != "android.provider.Telephony.SMS_RECEIVED") return

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

        if (fullBody.isEmpty() || !isBankishMessage(fullBody)) return

        // ── Layer A: WorkManager (background-safe, survives app kill) ──────────
        val prefs  = context.getSharedPreferences("buddget_sms", Context.MODE_PRIVATE)
        val token  = prefs.getString("access_token", null)
        val apiUrl = prefs.getString("api_url", null)

        if (token != null && apiUrl != null) {
            val data = workDataOf(
                SmsForwardWorker.KEY_MESSAGE to fullBody,
                SmsForwardWorker.KEY_SENDER  to (sender ?: ""),
                SmsForwardWorker.KEY_TOKEN   to token,
                SmsForwardWorker.KEY_API_URL to apiUrl,
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

    /**
     * Broad keyword filter applied before queuing the WorkManager job.
     * Keeps personal SMS off the API entirely.
     * Custom keywords can't be read from the JS store here — they are applied
     * server-side by the Gemini parser.
     */
    private fun isBankishMessage(text: String): Boolean {
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
               arabicKeywords.any { text.contains(it) }
    }
}
