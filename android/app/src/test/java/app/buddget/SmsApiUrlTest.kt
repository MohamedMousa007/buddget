package app.buddget

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SmsApiUrlTest {
    @Test fun allowsProductionAndSubdomains() {
        assertTrue(SmsApiUrl.isAllowed("https://buddget.app", false))
        assertTrue(SmsApiUrl.isAllowed("https://api.buddget.app", false))
        assertTrue(SmsApiUrl.isAllowed("https://buddget.app/", false))
    }

    @Test fun rejectsEverythingElse() {
        assertFalse(SmsApiUrl.isAllowed(null, false))
        assertFalse(SmsApiUrl.isAllowed("", false))
        assertFalse(SmsApiUrl.isAllowed("http://buddget.app", false))
        assertFalse(SmsApiUrl.isAllowed("https://evilbuddget.app", false))
        assertFalse(SmsApiUrl.isAllowed("https://buddget.app.evil.com", false))
        assertFalse(SmsApiUrl.isAllowed("https://buddget.app@evil.com", false))
        assertFalse(SmsApiUrl.isAllowed("https://evil.com/?h=buddget.app", false))
        assertFalse(SmsApiUrl.isAllowed("https://buddget.app:8443", false))
        assertFalse(SmsApiUrl.isAllowed("https://buddget.app/x", false))
    }

    @Test fun localhostOnlyInDebugBuilds() {
        assertFalse(SmsApiUrl.isAllowed("http://localhost:3000", false))
        assertTrue(SmsApiUrl.isAllowed("http://localhost:3000", true))
        assertFalse(SmsApiUrl.isAllowed("http://evil.com", true))
    }
}
