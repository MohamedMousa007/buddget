package app.buddget

import android.content.Context
import android.content.SharedPreferences
import android.security.keystore.KeyPermanentlyInvalidatedException
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import javax.crypto.AEADBadTagException

/**
 * Single access point for the SMS ingest token, API URL, owner stamp and the
 * pending-SMS queue. Backed by EncryptedSharedPreferences (Keystore AES key).
 * Values that an older build wrote to the plaintext "buddget_sms" file are
 * copied across once and the plaintext file is wiped.
 */
object SmsStore {
    private const val LEGACY = "buddget_sms"
    private const val SECURE = "buddget_sms_secure"
    private const val META = "buddget_sms_meta"
    private const val NEEDS_RESYNC = "needs_resync"

    @Volatile private var cached: SharedPreferences? = null

    @Synchronized
    fun prefs(context: Context): SharedPreferences {
        cached?.let { return it }
        val app = context.applicationContext
        val secure = open(app)
        migrateLegacy(app, secure)
        cached = secure
        return secure
    }

    private fun open(app: Context): SharedPreferences {
        try {
            return create(app)
        } catch (first: Exception) {
            // A transient Keystore failure (OEM hiccup, early boot) must never wipe the token and queue.
            try {
                return create(app)
            } catch (second: Exception) {
                if (!isKeyLoss(second)) throw second
                // Keystore key lost (restore / OS upgrade): the ciphertext is unreadable, start clean.
                app.deleteSharedPreferences(SECURE)
                app.getSharedPreferences(META, Context.MODE_PRIVATE).edit().putBoolean(NEEDS_RESYNC, true).apply()
                return create(app)
            }
        }
    }

    private fun isKeyLoss(e: Throwable?): Boolean {
        var t = e
        while (t != null) {
            if (t is AEADBadTagException || t.javaClass.simpleName == "InvalidProtocolBufferException" || t is KeyPermanentlyInvalidatedException) return true
            t = t.cause
        }
        return false
    }

    /** True when the secure store was recreated empty: the app must re-save the ingest token on next open. */
    fun needsResync(context: Context): Boolean =
        context.applicationContext.getSharedPreferences(META, Context.MODE_PRIVATE).getBoolean(NEEDS_RESYNC, false)

    fun clearNeedsResync(context: Context) {
        context.applicationContext.getSharedPreferences(META, Context.MODE_PRIVATE).edit().remove(NEEDS_RESYNC).apply()
    }

    private fun create(app: Context): SharedPreferences {
        val key = MasterKey.Builder(app).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build()
        return EncryptedSharedPreferences.create(
            app, SECURE, key,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    }

    private fun migrateLegacy(app: Context, secure: SharedPreferences) {
        val legacy = app.getSharedPreferences(LEGACY, Context.MODE_PRIVATE)
        val all = legacy.all
        if (all.isEmpty()) return
        val edit = secure.edit()
        for ((k, v) in all) {
            when (v) {
                is String -> edit.putString(k, v)
                is Boolean -> edit.putBoolean(k, v)
                is Int -> edit.putInt(k, v)
                is Long -> edit.putLong(k, v)
                is Float -> edit.putFloat(k, v)
            }
        }
        if (edit.commit()) legacy.edit().clear().commit()
    }
}
