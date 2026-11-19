package app.buddget

import java.net.URI

/** The bundled app's WebView origin (Capacitor serves it from https://localhost; no server.hostname is set). Only it may use the microphone. */
object WebViewOrigin {
    fun isAppOrigin(raw: String?): Boolean {
        if (raw.isNullOrBlank()) return false
        val uri = try { URI(raw.trim()) } catch (e: Exception) { return false }
        return uri.scheme?.lowercase() == "https" &&
            uri.host?.lowercase() == "localhost" &&
            (uri.port == -1 || uri.port == 443) &&
            uri.userInfo == null
    }
}
