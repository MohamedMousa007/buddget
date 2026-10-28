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
        val shouldForward = SmsGate.shouldForward(mode, sender, fullBody)
        if (fullBody.isEmpty() || !shouldForward) return

        // WorkManager is the SINGLE forwarding path — works whether the app is
        // open or killed, and the server dedup makes retries idempotent. The
        // user is notified by the server-side FCM push once parsing completes.
        // Credentials are NOT baked into the job — the worker reads the current
        // token/apiUrl from SharedPreferences at execution time, and routes
        // undeliverable SMS to PendingSmsQueue instead of dropping them.
        // Stamped NOW — a job delayed offline must report when the SMS
        // actually arrived, not when the POST finally ran.
        val receivedAt = SmsTime.nowIso()
        // Ledger-first: the SMS is "pending" until the worker's POST succeeds.
        // The app renders this as a waiting-to-sync card while offline. Stamp the
        // owning account so an account switch can't drain it into the wrong user.
        val tokenUserId = prefs.getString("token_user_id", "") ?: ""
        // Generated ONCE per received SMS and persisted with it: a queue retry reuses it
        // (server treats it as the same message), while a genuine twin gets its own.
        val eventId = java.util.UUID.randomUUID().toString()
        PendingSmsQueue.enqueue(context, fullBody, sender ?: "", receivedAt, tokenUserId, eventId)
        val data = workDataOf(
            SmsForwardWorker.KEY_MESSAGE     to fullBody,
            SmsForwardWorker.KEY_SENDER      to (sender ?: ""),
            SmsForwardWorker.KEY_RECEIVED_AT to receivedAt,
            SmsForwardWorker.KEY_EVENT_ID    to eventId,
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
