package app.buddget

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.net.HttpURLConnection
import java.net.URL

/**
 * WorkManager worker that POSTs an SMS body to /api/sms/parse.
 *
 * Runs in its own process context — works even when the app is completely killed.
 * Uses HttpURLConnection (no extra deps). Retries on 5xx / network errors.
 *
 * Credentials are read from SharedPreferences AT EXECUTION TIME, not baked into
 * the job: an SMS queued offline may run hours later, after the app has rotated
 * the stored ingest token — the job must use whatever is current, not a stale
 * snapshot. Undeliverable SMS (no token, terminal 4xx, retries exhausted) go to
 * PendingSmsQueue instead of being dropped; the app drains it on next open.
 */
class SmsForwardWorker(ctx: Context, params: WorkerParameters) : CoroutineWorker(ctx, params) {

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val message    = inputData.getString(KEY_MESSAGE) ?: return@withContext Result.failure()
        val sender     = inputData.getString(KEY_SENDER) ?: ""
        val receivedAt = inputData.getString(KEY_RECEIVED_AT) ?: ""

        val prefs  = applicationContext.getSharedPreferences("buddget_sms", Context.MODE_PRIVATE)
        val token  = prefs.getString("access_token", null)
        val apiUrl = prefs.getString("api_url", null)

        // The receiver already put this SMS in PendingSmsQueue (ledger-first);
        // terminal outcomes below just leave it there for the app-open drain.
        if (token == null || apiUrl == null) {
            recordRun(prefs, "no_token")
            return@withContext Result.failure()
        }

        if (runAttemptCount >= MAX_ATTEMPTS) {
            recordRun(prefs, "retries_exhausted")
            return@withContext Result.failure()
        }

        val json = buildBody(message, sender, receivedAt)
        val url  = URL("$apiUrl/api/sms/parse")

        return@withContext try {
            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                setRequestProperty("Content-Type", "application/json")
                setRequestProperty("Authorization", "Bearer $token")
                doOutput = true
                connectTimeout = 15_000
                readTimeout    = 30_000
            }
            conn.outputStream.bufferedWriter(Charsets.UTF_8).use { it.write(json) }
            val code = conn.responseCode
            conn.disconnect()
            when {
                code in 200..299 -> {
                    PendingSmsQueue.remove(applicationContext, message, receivedAt)
                    recordRun(prefs, "ok")
                    Result.success()
                }
                code >= 500 -> {
                    recordRun(prefs, "http_$code")
                    Result.retry()   // transient server error
                }
                else -> {
                    // 4xx — bad/stale token or bad request. Stays in the queue;
                    // the app-open drain replays it after ensureIngestToken
                    // saves a fresh token.
                    recordRun(prefs, "http_$code")
                    Result.failure()
                }
            }
        } catch (e: Exception) {
            recordRun(prefs, "network_error")
            Result.retry() // network unavailable — WorkManager will retry with backoff
        }
    }

    private fun recordRun(prefs: android.content.SharedPreferences, result: String) {
        prefs.edit()
            .putString("last_run_at", SmsTime.nowIso())
            .putString("last_result", result)
            .apply()
    }

    private fun buildBody(message: String, sender: String, receivedAt: String): String {
        fun esc(s: String) = s
            .replace("\\", "\\\\")
            .replace("\"", "\\\"")
            .replace("\n", "\\n")
            .replace("\r", "\\r")
            .replace("\t", "\\t")

        return """{"message":"${esc(message)}","sender":"${esc(sender)}","source":"sms","receivedAt":"${esc(receivedAt)}"}"""
    }

    companion object {
        const val KEY_MESSAGE     = "message"
        const val KEY_SENDER      = "sender"
        const val KEY_RECEIVED_AT = "received_at"
        const val MAX_ATTEMPTS = 5
    }
}
