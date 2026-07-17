package app.buddget

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/**
 * Persistent "captured but not yet synced" ledger. SmsReceiver enqueues every
 * forwarded SMS up front; SmsForwardWorker removes it once the server accepts
 * the POST. Whatever remains is offline/undelivered — the app renders it as
 * "waiting to sync" cards and the app-open/reconnect drain replays it. Cap 50,
 * oldest evicted (mirrors iOS). The server dedups by sms_hash, so a drain
 * racing a WorkManager delivery is harmless.
 */
/** minSdk-24-safe UTC ISO-8601 timestamp (java.time needs API 26). */
object SmsTime {
    fun nowIso(): String {
        val fmt = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", java.util.Locale.US)
        fmt.timeZone = java.util.TimeZone.getTimeZone("UTC")
        return fmt.format(java.util.Date())
    }
}

object PendingSmsQueue {
    private const val PREFS = "buddget_sms"
    private const val KEY = "pending_queue"
    private const val CAP = 50

    @Synchronized
    fun enqueue(context: Context, message: String, sender: String, receivedAt: String, userId: String) {
        val items = read(context)
        items.put(JSONObject().apply {
            put("message", message)
            put("sender", sender)
            put("receivedAt", receivedAt)
            put("source", "sms")
            // Owner-stamp: the JS drain filters by userId so an account switch
            // can't forward this SMS into the wrong user's account.
            put("userId", userId)
        })
        write(context, trim(items))
    }

    /** Returns queued items WITHOUT clearing — for the in-app pending preview. */
    @Synchronized
    fun peek(context: Context): JSONArray = read(context)

    /** Removes one item after successful delivery (matched by body + receive time). */
    @Synchronized
    fun remove(context: Context, message: String, receivedAt: String) {
        val items = read(context)
        val kept = JSONArray()
        var removed = false
        for (i in 0 until items.length()) {
            val item = items.getJSONObject(i)
            if (!removed &&
                item.optString("message") == message &&
                item.optString("receivedAt") == receivedAt
            ) {
                removed = true
                continue
            }
            kept.put(item)
        }
        if (removed) write(context, kept)
    }

    @Synchronized
    fun count(context: Context): Int = read(context).length()

    private fun read(context: Context): JSONArray {
        val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY, null) ?: return JSONArray()
        return try { JSONArray(raw) } catch (_: Exception) { JSONArray() }
    }

    private fun write(context: Context, items: JSONArray) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().putString(KEY, items.toString()).apply()
    }

    private fun trim(items: JSONArray): JSONArray {
        if (items.length() <= CAP) return items
        val trimmed = JSONArray()
        for (i in items.length() - CAP until items.length()) trimmed.put(items.getJSONObject(i))
        return trimmed
    }
}
