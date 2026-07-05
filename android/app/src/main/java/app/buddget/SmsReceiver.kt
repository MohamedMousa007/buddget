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

        // Phase 1 default = "sender": forward any business-sender SMS that has a
        // number; personal (long numeric) senders still require a keyword match,
        // so personal SMS stay off the API. "keyword" restores the legacy gate.
        val mode = prefs.getString("sms_forward_mode", "sender") ?: "sender"
        val shouldForward = when (mode) {
            "keyword" -> isBankishMessage(fullBody)
            else      -> (isBusinessSender(sender) && hasDigit(fullBody)) || isBankishMessage(fullBody)
        }
        if (fullBody.isEmpty() || !shouldForward) return

        // WorkManager is the SINGLE forwarding path — works whether the app is
        // open or killed, and the server dedup makes retries idempotent. The
        // user is notified by the server-side FCM push once parsing completes.
        // Credentials are NOT baked into the job — the worker reads the current
        // token/apiUrl from SharedPreferences at execution time, and routes
        // undeliverable SMS to PendingSmsQueue instead of dropping them.
        val data = workDataOf(
            SmsForwardWorker.KEY_MESSAGE     to fullBody,
            SmsForwardWorker.KEY_SENDER      to (sender ?: ""),
            // Stamped NOW — a job delayed offline must report when the SMS
            // actually arrived, not when the POST finally ran.
            SmsForwardWorker.KEY_RECEIVED_AT to SmsTime.nowIso(),
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

    private fun hasDigit(text: String): Boolean = text.any { it.isDigit() }

    /**
     * A "business" sender is an alphanumeric ID (e.g. "VF-Cash", "CIB") or a
     * short numeric code (≤7 digits, e.g. "19666") — i.e. NOT a normal personal
     * phone number (≥8 digits). Financial institutions always send from these,
     * so forwarding any business-sender SMS with a number captures every
     * bank/wallet transaction regardless of wording, while personal SMS (long
     * numeric senders) are still excluded unless they hit a keyword.
     */
    private fun isBusinessSender(sender: String?): Boolean {
        val s = sender?.trim()?.removePrefix("+") ?: return false
        if (s.isEmpty()) return false
        if (s.any { it.isLetter() }) return true               // alphanumeric ID
        val digits = s.count { it.isDigit() }
        return digits in 1..7                                   // short code
    }

    /**
     * Broad keyword filter — the Phase-2 path and the fallback for personal
     * senders. The server's curated pattern library + pre-filter do the precise
     * classification.
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
