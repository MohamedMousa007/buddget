package app.buddget

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SmsGateTest {
    @Test fun currencyCodeInsideWordIsNotBankish() {
        assertFalse(SmsGate.isBankishMessage("Hi Sarah, see you tomorrow"))
        assertFalse(SmsGate.isBankishMessage("please disarm the alarm"))
        assertFalse(SmsGate.shouldForward("keyword", "+201001234567", "Sarah says hi"))
    }

    @Test fun digitAdjacentCurrencyIsBankish() {
        assertTrue(SmsGate.isBankishMessage("Paid SAR 50.00 at Cafe"))
        assertTrue(SmsGate.isBankishMessage("Paid 1,200.50EGP at Cafe"))
    }

    @Test fun otpIsDroppedButOtpFooterOnATransactionIsKept() {
        assertFalse(SmsGate.shouldForward("sender", "CIB", "Your OTP is 123456. Do not share it."))
        assertFalse(SmsGate.shouldForward("sender", "CIB", "رمز التحقق 123456"))
        assertTrue(SmsGate.shouldForward("sender", "CIB", "EGP 100 debited at Shop. Never share your OTP."))
    }

    @Test fun cardPurchaseWithNeverShareFooterIsForwarded() {
        // Fixture mirrors src/lib/sms/patterns/__tests__/patterns.test.ts (non-OTP on the server).
        assertTrue(SmsGate.shouldForward("sender", "CIB", "Your card ending 1234 was used for EGP 450.00 at CARREFOUR. Never share your PIN or OTP."))
        assertTrue(SmsGate.shouldForward("keyword", null, "You paid EGP 90.00 at Discount Mart. Do not share your PIN."))
        assertTrue(SmsGate.shouldForward("sender", "CIB", "تم الدفع 150 جنيه لدى متجر. لا تشارك رمز التحقق"))
    }

    @Test fun otpWithoutAmountIsStillDropped() {
        assertFalse(SmsGate.shouldForward("sender", "CIB", "Never share your PIN or OTP with anyone. Code 482913"))
    }

    @Test fun marketingFromBusinessSenderIsDropped() {
        assertFalse(SmsGate.shouldForward("sender", "Shop", "Flash sale 50% off today 12 items"))
        assertFalse(SmsGate.shouldForward("sender", "PROMO", "Visit us 24/7"))
    }

    @Test fun businessSenderWithDigitStillForwardedInSenderMode() {
        assertTrue(SmsGate.shouldForward("sender", "VF-Cash", "You received 500 from Ahmed"))
        assertFalse(SmsGate.shouldForward("sender", "01001234567", "call me at 5"))
    }

    @Test fun evictionDropsExpiredFirstThenOldest() {
        val day = 86_400_000L
        val now = 100 * day
        val times = listOf(now - 40 * day, now - 3 * day, now - 2 * day, now - day)
        assertEquals(setOf(0), SmsGate.evictionIndexes(times, now, cap = 3))
        assertEquals(setOf(0, 1), SmsGate.evictionIndexes(times, now, cap = 2))
        assertEquals(emptySet<Int>(), SmsGate.evictionIndexes(times.drop(1), now, cap = 3))
    }

    @Test fun retryableStatuses() {
        for (c in listOf(401, 408, 409, 429, 500, 503, 202)) assertTrue(c.toString(), SmsGate.isRetryableStatus(c))
        for (c in listOf(400, 403, 404, 422)) assertFalse(c.toString(), SmsGate.isRetryableStatus(c))
    }

    @Test fun aQueuedSmsIsOnlySentForTheAccountItArrivedUnder() {
        assertTrue(SmsGate.belongsToCurrentAccount("user-a", "user-a"))
        assertFalse(SmsGate.belongsToCurrentAccount("user-a", "user-b"))
        assertTrue(SmsGate.belongsToCurrentAccount("", "user-b"))
        assertTrue(SmsGate.belongsToCurrentAccount("user-a", ""))
    }

    @Test fun anOldSmsIsEvictedEvenWhenTheQueueIsNotFull() {
        val day = 24L * 60 * 60 * 1000
        val now = 100 * day
        assertEquals(setOf(0), SmsGate.evictionIndexes(listOf(now - 40 * day, now - day), now, 200))
        assertEquals(emptySet<Int>(), SmsGate.evictionIndexes(listOf(now - 2 * day, now - day), now, 200))
    }
}
