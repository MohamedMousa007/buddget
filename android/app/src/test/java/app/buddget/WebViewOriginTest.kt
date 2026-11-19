package app.buddget

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class WebViewOriginTest {
    @Test fun allowsTheBundledApp() {
        assertTrue(WebViewOrigin.isAppOrigin("https://localhost"))
        assertTrue(WebViewOrigin.isAppOrigin("https://localhost/"))
    }

    @Test fun deniesEverythingElse() {
        for (o in listOf(null, "", "https://evil.example", "http://localhost", "https://localhost.evil.example", "https://localhost:8443", "https://user@localhost", "not a url")) {
            assertFalse(o.toString(), WebViewOrigin.isAppOrigin(o))
        }
    }
}
