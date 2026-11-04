package app.buddget

/**
 * Pure on-device forwarding gate + queue eviction policy (unit-testable, no Android deps).
 * Nothing that fails the gate ever leaves the phone.
 */
object SmsGate {
    private const val DAY_MS = 24L * 60 * 60 * 1000

    private val currencyCodes = listOf("egp", "aed", "sar", "qar", "kwd", "omr", "bhd")
    // A currency code only counts next to a digit ("SAR 50", "50EGP"); never inside a word ("Sarah", "disarm").
    private val currencyRegex = Regex(
        "(?i)(?:\\d[\\d.,]*\\s?(?:${currencyCodes.joinToString("|")})(?![a-z]))|(?:(?<![a-z])(?:${currencyCodes.joinToString("|")})\\s?\\d)"
    )
    private val wordKeywordRegex = Regex(
        "(?i)(?<![a-z])(debited|credited|spent at|purchase of|transaction of|withdrawn|inward transfer|deposit|instapay|vodafone cash|fawry)(?![a-z])"
    )
    private val arabicKeywords = listOf(
        "جنيه", "تم خصم", "تم سحب", "تم دفع", "عملية شراء", "تم إيداع", "تم إضافة",
    )
    private val strongTxnRegex = Regex(
        "(?i)(?<![a-z])(debited|credited|spent at|purchase of|transaction of|withdrawn|inward transfer)(?![a-z])"
    )
    private val strongTxnArabic = listOf("تم خصم", "تم سحب", "تم دفع", "عملية شراء", "تم إيداع", "تم إضافة")

    // Wider than strongTxn: wording a card/wallet alert uses for money that moved. Only counted next to an amount.
    private val moneyVerbRegex = Regex(
        "(?i)(?<![a-z])(used (?:for|at)|paid|payment|received|refund(?:ed)?|debit(?:ed)?|credit(?:ed)?|purchase|spent|withdr(?:awn|awal)|transfer(?:red)?|deposit(?:ed)?|charged|sent)(?![a-z])"
    )
    private val moneyVerbArabic = listOf("تم الدفع", "دفع", "خصم", "تحويل", "شراء", "سحب", "إيداع", "استلام", "استرداد")

    private val otpRegex = Regex(
        "(?i)(?<![a-z])(otp|one[- ]time (?:password|code|pin)|verification code|security code|passcode|do not share|never share|don't share)(?![a-z])"
    )
    private val otpArabic = listOf("رمز التحقق", "كلمة المرور المؤقتة", "رمز التفعيل", "لا تشارك")

    private val marketingRegex = Regex(
        "(?i)(?<![a-z])(promo(?:tion)?|promo code|coupon|discount|\\d+\\s?% ?off|limited offer|special offer|exclusive offer|unsubscribe|reply stop|win a|free gift|flash sale)(?![a-z])"
    )
    private val marketingArabic = listOf("عرض خاص", "خصم حصري", "كوبون", "اشترك الآن", "للإلغاء أرسل")
    private val marketingSenders = setOf("ads", "promo", "promos", "offers", "offer", "marketing", "deals", "sale")

    fun hasDigit(text: String): Boolean = text.any { it.isDigit() }

    fun hasStrongTransaction(text: String): Boolean =
        strongTxnRegex.containsMatchIn(text) || strongTxnArabic.any { text.contains(it) }

    /** An amount with a currency AND a verb for money that moved. "Never share" boilerplate alone is not an OTP. */
    fun carriesMoneyMovement(text: String): Boolean {
        if (hasStrongTransaction(text)) return true
        val hasAmount = currencyRegex.containsMatchIn(text) || (text.contains("جنيه") && hasDigit(text))
        return hasAmount && (moneyVerbRegex.containsMatchIn(text) || moneyVerbArabic.any { text.contains(it) })
    }

    fun isOtp(text: String): Boolean =
        otpRegex.containsMatchIn(text) || otpArabic.any { text.contains(it) }

    fun isMarketing(sender: String?, text: String): Boolean {
        val s = sender?.trim()?.lowercase()?.replace(Regex("[^a-z]"), "") ?: ""
        if (s in marketingSenders) return true
        return marketingRegex.containsMatchIn(text) || marketingArabic.any { text.contains(it) }
    }

    /** Alphanumeric ID or short code (<=7 digits); NOT a personal phone number. */
    fun isBusinessSender(sender: String?): Boolean {
        val s = sender?.trim()?.removePrefix("+") ?: return false
        if (s.isEmpty()) return false
        if (s.any { it.isLetter() }) return true
        return s.count { it.isDigit() } in 1..7
    }

    fun isBankishMessage(text: String): Boolean =
        currencyRegex.containsMatchIn(text) ||
            wordKeywordRegex.containsMatchIn(text) ||
            arabicKeywords.any { text.contains(it) }

    fun shouldForward(mode: String, sender: String?, body: String): Boolean {
        if (body.isEmpty()) return false
        // OTP / marketing wording is dropped unless the text also states an actual money movement.
        if ((isOtp(body) || isMarketing(sender, body)) && !carriesMoneyMovement(body)) return false
        return if (mode == "keyword") isBankishMessage(body)
        else (isBusinessSender(sender) && hasDigit(body)) || isBankishMessage(body)
    }

    /**
     * Indexes (into [receivedAts], oldest first) to evict so at most [cap] remain:
     * anything older than [maxAgeMs] goes first, then the oldest of the rest.
     */
    fun evictionIndexes(receivedAts: List<Long>, nowMs: Long, cap: Int, maxAgeMs: Long = 30 * DAY_MS): Set<Int> {
        val out = linkedSetOf<Int>()
        receivedAts.forEachIndexed { i, t -> if (t > 0 && nowMs - t > maxAgeMs) out.add(i) }
        var kept = receivedAts.size - out.size
        var i = 0
        while (kept > cap && i < receivedAts.size) {
            if (out.add(i)) kept--
            i++
        }
        return out
    }

    /**
     * A queued SMS may only be sent with the token of the account it arrived under. A retried job can run hours later,
     * after another user signed in, and would otherwise deliver one person's bank text into another's account. An
     * unstamped SMS (arrived while signed out) or an unstamped token keeps the old behaviour.
     */
    fun belongsToCurrentAccount(smsOwner: String, tokenOwner: String): Boolean =
        smsOwner.isEmpty() || tokenOwner.isEmpty() || smsOwner == tokenOwner

    /** Worker HTTP outcome: true = transient, retry with backoff; false = leave queued without retrying. */
    fun isRetryableStatus(code: Int): Boolean =
        code >= 500 || code == 408 || code == 429 || code == 401 || code == 409 || code == 202
}
