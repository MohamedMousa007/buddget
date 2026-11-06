package app.buddget

import java.net.URI

/**
 * The only origins the SMS bridge may send a bank SMS and its ingest token to. The URL arrives from JS, so anything that
 * can run script in the WebView must not be able to repoint it: https on buddget.app (or a subdomain) only, mirroring
 * capacitor.config.ts `allowNavigation`. http://localhost is accepted in debuggable builds for local development.
 */
object SmsApiUrl {
    private const val HOST = "buddget.app"
    private val LOCAL_HOSTS = setOf("localhost", "127.0.0.1")

    fun isAllowed(raw: String?, debuggable: Boolean): Boolean {
        if (raw.isNullOrBlank()) return false
        val uri = try { URI(raw.trim()) } catch (e: Exception) { return false }
        val host = uri.host?.lowercase() ?: return false
        if (uri.userInfo != null || uri.query != null || uri.fragment != null) return false
        if (!uri.path.isNullOrEmpty() && uri.path != "/") return false
        return when (uri.scheme?.lowercase()) {
            "https" -> (uri.port == -1 || uri.port == 443) && (host == HOST || host.endsWith(".$HOST"))
            "http" -> debuggable && host in LOCAL_HOSTS
            else -> false
        }
    }
}
