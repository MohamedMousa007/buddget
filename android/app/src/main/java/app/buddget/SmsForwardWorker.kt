package app.buddget

import android.content.Context
import android.os.Build
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.time.Instant
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/**
 * WorkManager worker that POSTs an SMS body to /api/sms/parse.
 *
 * Runs in its own process context — works even when the app is completely killed.
 * Uses HttpURLConnection (no extra deps). Retries on 5xx / network errors.
 */
class SmsForwardWorker(ctx: Context, params: WorkerParameters) : CoroutineWorker(ctx, params) {

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        if (runAttemptCount >= MAX_ATTEMPTS) return@withContext Result.failure()

        val message = inputData.getString(KEY_MESSAGE) ?: return@withContext Result.failure()
        val sender  = inputData.getString(KEY_SENDER) ?: ""
        val token   = inputData.getString(KEY_TOKEN)  ?: return@withContext Result.failure()
        val apiUrl  = inputData.getString(KEY_API_URL) ?: return@withContext Result.failure()

        val json = buildBody(message, sender)
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
                code in 200..299 -> Result.success()
                code >= 500      -> Result.retry()   // transient server error
                else             -> Result.failure()  // 4xx — bad token / bad request
            }
        } catch (e: Exception) {
            Result.retry() // network unavailable — WorkManager will retry with backoff
        }
    }

    private fun buildBody(message: String, sender: String): String {
        fun esc(s: String) = s
            .replace("\\", "\\\\")
            .replace("\"", "\\\"")
            .replace("\n", "\\n")
            .replace("\r", "\\r")
            .replace("\t", "\\t")

        val now = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Instant.now().toString()
        } else {
            SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US)
                .also { it.timeZone = TimeZone.getTimeZone("UTC") }
                .format(Date())
        }

        return """{"message":"${esc(message)}","sender":"${esc(sender)}","source":"sms","receivedAt":"$now"}"""
    }

    companion object {
        const val KEY_MESSAGE  = "message"
        const val KEY_SENDER   = "sender"
        const val KEY_TOKEN    = "token"
        const val KEY_API_URL  = "api_url"
        const val MAX_ATTEMPTS = 5
    }
}
