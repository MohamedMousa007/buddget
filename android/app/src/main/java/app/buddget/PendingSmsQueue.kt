package app.buddget

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/**
 * Persistent ring buffer for SMS the WorkManager path could not deliver
 * (missing token, terminal 4xx, retries exhausted). Mirrors the iOS
 * UserDefaults pending_queue: cap 50, oldest evicted, drained by the JS
 * layer on app open once a fresh ingest token is saved. The server dedups
 * by sms_hash, so replaying an already-delivered item is harmless.
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
    fun enqueue(context: Context, message: String, sender: String, receivedAt: String) {
        val items = read(context)
        items.put(JSONObject().apply {
            put("message", message)
            put("sender", sender)
            put("receivedAt", receivedAt)
            put("source", "sms")
        })
        write(context, trim(items))
    }

    /** Returns all queued items and clears the queue. */
    @Synchronized
    fun drain(context: Context): JSONArray {
        val items = read(context)
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().remove(KEY).apply()
        return items
    }

    /** Re-appends items whose replay failed, respecting the cap. */
    @Synchronized
    fun requeue(context: Context, failed: JSONArray) {
        val items = read(context)
        for (i in 0 until failed.length()) items.put(failed.getJSONObject(i))
        write(context, trim(items))
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
