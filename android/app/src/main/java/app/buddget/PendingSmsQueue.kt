package app.buddget

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/**
 * Persistent "captured but not yet synced" ledger. SmsReceiver enqueues every
 * forwarded SMS up front; SmsForwardWorker removes it once the server accepts
 * the POST. Whatever remains is offline/undelivered — the app renders it as
 * "waiting to sync" cards and the app-open/reconnect drain replays it. Cap 200;
 * entries older than 30 days go first, then the oldest, each counted in evicted_count. The server dedups by sms_hash, so a drain
 * racing a WorkManager delivery is harmless.
 */
/** minSdk-24-safe UTC ISO-8601 timestamp (java.time needs API 26). */
object SmsTime {
    fun nowIso(): String {
        val fmt = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", java.util.Locale.US)
        fmt.timeZone = java.util.TimeZone.getTimeZone("UTC")
        return fmt.format(java.util.Date())
    }

    /** Epoch millis of an ISO-8601 UTC stamp, 0 when unparseable. */
    fun parseMillis(iso: String): Long = try {
        val fmt = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", java.util.Locale.US)
        fmt.timeZone = java.util.TimeZone.getTimeZone("UTC")
        fmt.parse(iso)?.time ?: 0L
    } catch (_: Exception) { 0L }
}

object PendingSmsQueue {
    private const val KEY = "pending_queue"
    private const val CAP = 200
    private const val EVICTED_KEY = "evicted_count"

    @Synchronized
    fun enqueue(context: Context, message: String, sender: String, receivedAt: String, userId: String, eventId: String = "") {
        val items = read(context)
        items.put(JSONObject().apply {
            put("message", message)
            put("sender", sender)
            put("receivedAt", receivedAt)
            put("source", "sms")
            // Owner-stamp: the JS drain filters by userId so an account switch
            // can't forward this SMS into the wrong user's account.
            put("userId", userId)
            if (eventId.isNotEmpty()) put("eventId", eventId)
        })
        write(context, trim(context, items))
    }

    /** Returns queued items WITHOUT clearing — for the in-app pending preview. */
    @Synchronized
    fun peek(context: Context): JSONArray = read(context)

    /** Removes one item after successful delivery (matched by eventId, legacy items by body + receive time). */
    @Synchronized
    fun remove(context: Context, message: String, receivedAt: String, eventId: String = "") {
        val items = read(context)
        val kept = JSONArray()
        var removed = false
        for (i in 0 until items.length()) {
            val item = items.getJSONObject(i)
            val sameItem = if (eventId.isNotEmpty() && item.has("eventId")) item.optString("eventId") == eventId
            else item.optString("message") == message && item.optString("receivedAt") == receivedAt
            if (!removed && sameItem) {
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
        val raw = SmsStore.prefs(context)
            .getString(KEY, null) ?: return JSONArray()
        return try { JSONArray(raw) } catch (_: Exception) { JSONArray() }
    }

    private fun write(context: Context, items: JSONArray) {
        SmsStore.prefs(context)
            .edit().putString(KEY, items.toString()).apply()
    }

    @Synchronized
    fun evictedCount(context: Context): Int =
        SmsStore.prefs(context).getInt(EVICTED_KEY, 0)

    /** receivedAt of the oldest queued SMS ("" when empty) - the backlog age metric. */
    @Synchronized
    fun oldestReceivedAt(context: Context): String {
        val items = read(context)
        var oldest = ""
        for (i in 0 until items.length()) {
            val t = items.getJSONObject(i).optString("receivedAt")
            if (t.isNotEmpty() && (oldest.isEmpty() || t < oldest)) oldest = t
        }
        return oldest
    }

    private fun trim(context: Context, items: JSONArray): JSONArray {
        val times = (0 until items.length()).map { SmsTime.parseMillis(items.getJSONObject(it).optString("receivedAt")) }
        val evict = SmsGate.evictionIndexes(times, System.currentTimeMillis(), CAP)
        val kept = JSONArray()
        for (i in 0 until items.length()) if (i !in evict) kept.put(items.getJSONObject(i))
        if (evict.isNotEmpty()) {
            val prefs = SmsStore.prefs(context)
            prefs.edit().putInt(EVICTED_KEY, prefs.getInt(EVICTED_KEY, 0) + evict.size).apply()
        }
        return kept
    }
}
