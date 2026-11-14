import AppIntents
import CryptoKit
import Foundation

/// "Catch Bank SMS" — the Buddget action a Shortcuts Message automation runs.
/// Executes headless in the background (openAppWhenRun = false) even when the
/// app is killed, POSTs the message to /api/sms/parse with the non-expiring
/// ingest token, and never surfaces errors (automations must stay silent).
struct CatchBankSmsIntent: AppIntent {
    static var title: LocalizedStringResource = "Catch Bank SMS"
    static var description = IntentDescription(
        "Hands a bank message to Buddget so your spending logs itself — silently, in the background."
    )
    static var openAppWhenRun: Bool = false

    @Parameter(title: "Bank Message")
    var message: String

    /// Kept only so Shortcuts already built with the old two-field action keep running. iOS never hands an app the
    /// sender of a message (production: 0 of 824 forwarded messages carried one), so it is no longer shown or asked for;
    /// the server names the provider from the message text (see providerFromBody.ts).
    @Parameter(title: "Sender", default: "")
    var sender: String?

    static var parameterSummary: some ParameterSummary {
        Summary("Catch \(\.$message)")
    }

    func perform() async throws -> some IntentResult {
        // Stamp that the Shortcut fired BEFORE the enable gate — this is the only
        // on-device proof the automation exists (iOS exposes no API to enumerate
        // Shortcuts), so it must be recorded even when tracking is off, feeding
        // the "wired" capability that gates the Settings switch vs. setup CTA.
        SmsCredentialStore.recordRun(result: "detected")
        guard SmsCredentialStore.isEnabled else { return .result() }
        // Same on-device gate as Android's SmsGate: one-time codes never leave the phone
        // unless the text also states an actual money movement.
        guard !SmsOtpGate.shouldDrop(message) else {
            SmsCredentialStore.recordRun(result: "skipped_otp")
            return .result()
        }

        // Ledger-first, mirroring Android's SmsReceiver/SmsForwardWorker split: the
        // SMS is durable BEFORE any network work, and delivery only ever REMOVES it.
        // The automation runs perform() inside a finite background window, and two
        // SMS in the same second run two of them inside that one window — whichever
        // loses the race is killed mid-flight. Sending first meant that kill landed
        // between "SMS arrived" and "enqueue on failure", losing the transaction with
        // no trace on the device or the server. Enqueueing first turns that same kill
        // into a delay: the app-open drain replays whatever is still queued.
        // One id and capture time per run, persisted in the queue: a retry reuses them, a genuine twin gets its own.
        // A run with the same text as one from the last 15 seconds shares that run's id and time instead, because
        // two automations on one phone fire for the same SMS and the server must see one capture sent twice.
        let (eventId, receivedAt) = SmsCredentialStore.captureIdentity(for: message)
        let from = sender ?? ""
        SmsCredentialStore.enqueuePending(message: message, sender: from, receivedAt: receivedAt,
                                          userId: SmsCredentialStore.tokenUserId ?? "", eventId: eventId)

        guard let token = SmsCredentialStore.token,
              SmsCredentialStore.tokenUserId?.isEmpty == false,
              let base = SmsCredentialStore.apiUrl,
              let url = URL(string: base + "/api/sms/parse") else {
            SmsCredentialStore.recordRun(result: "no_token")
            SmsBackgroundDrain.scheduleIfPending()
            return .result()
        }

        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.setValue(eventId, forHTTPHeaderField: "x-sms-event-id")
        // Single short attempt. The old 20s + 2s sleep + 20s retry could hold the
        // background window for 42s, which is what got the process killed in the
        // first place — the retry meant to prevent loss was causing it. The queue
        // is the retry now, so this only needs to cover a healthy radio.
        req.timeoutInterval = 15
        // receivedAt is stamped here, not by the server: a drained SMS can post days
        // late, and the server clock would file it under the wrong expense_date and
        // skew the SMS pairing window.
        req.httpBody = try JSONSerialization.data(withJSONObject: [
            "message": message,
            "sender": from,
            "source": "sms",
            "receivedAt": receivedAt,
            "eventId": eventId
        ])

        if await send(req) {
            SmsCredentialStore.removePending([["message": message, "receivedAt": receivedAt, "eventId": eventId]])
            SmsCredentialStore.recordRun(result: "delivered")
        } else {
            SmsCredentialStore.recordRun(result: "queued")
            SmsBackgroundDrain.scheduleIfPending()
        }
        return .result()
    }

    private func send(_ req: URLRequest) async -> Bool {
        guard let (_, response) = try? await URLSession.shared.data(for: req),
              let http = response as? HTTPURLResponse else { return false }
        // 202 / 409 mean the server is mid-claim on this SMS: keep it queued.
        return (200..<300).contains(http.statusCode) && http.statusCode != 202
    }
}

/// Repeat rule for two Shortcuts automations on one phone: runs with the same message text within `window` seconds
/// reuse one capture id and capture time. Pure so the decision can be tested without Keychain or the clock.
enum SmsCaptureRepeat {
    static let window: TimeInterval = 15
    static let maxRuns = 8

    struct Run: Codable, Equatable {
        let hash: String
        let at: TimeInterval
        let eventId: String
        let receivedAt: String
    }

    /// Same normalisation as computeSmsHash on the server (src/lib/sms/ingestGuards.ts): trim, collapse whitespace, lowercase.
    static func textHash(_ message: String) -> String {
        let normalized = message.components(separatedBy: .whitespacesAndNewlines)
            .filter { !$0.isEmpty }.joined(separator: " ").lowercased()
        return SHA256.hash(data: Data(normalized.utf8)).map { String(format: "%02x", $0) }.joined()
    }

    /// Returns the identity this run should use and the run list to store. Runs older than the window are dropped.
    static func resolve(runs: [Run], hash: String, now: Date,
                        mint: () -> (eventId: String, receivedAt: String)) -> (eventId: String, receivedAt: String, runs: [Run]) {
        let t = now.timeIntervalSince1970
        let fresh = runs.filter { t - $0.at >= 0 && t - $0.at < window }
        if let same = fresh.first(where: { $0.hash == hash }) {
            return (same.eventId, same.receivedAt, fresh)
        }
        let id = mint()
        let kept = Array((fresh + [Run(hash: hash, at: t, eventId: id.eventId, receivedAt: id.receivedAt)]).suffix(maxRuns))
        return (id.eventId, id.receivedAt, kept)
    }
}

/// Mirror of Android SmsGate for the OTP and marketing rules (the Shortcut has no sender, so no sender gate).
enum SmsOtpGate {
    private static let otp = try! NSRegularExpression(
        pattern: "(?<![a-z])(otp|one[- ]time (password|code|pin)|verification code|security code|passcode|do not share|never share|don't share)(?![a-z])",
        options: .caseInsensitive)
    private static let txn = try! NSRegularExpression(
        pattern: "(?<![a-z])(debited|credited|spent at|purchase of|transaction of|withdrawn|inward transfer)(?![a-z])",
        options: .caseInsensitive)
    // Keep this list in step with src/lib/sms/deviceOtpGate.ts and android/app/src/main/java/app/buddget/SmsGate.kt;
    // edit all three together. NSRegularExpression's \\d already covers Arabic-Indic digits.
    private static let currency = try! NSRegularExpression(
        pattern: "(?:\\d[\\d.,]*\\s?(?:egp|aed|sar|qar|kwd|omr|bhd|usd|eur|gbp|l\\.?e|sr|ج\\.?م)(?![a-z]))|(?:(?<![a-z])(?:egp|aed|sar|qar|kwd|omr|bhd|usd|eur|gbp|l\\.?e|sr|e£|ج\\.?م)\\s?\\d)",
        options: .caseInsensitive)
    private static let moneyVerb = try! NSRegularExpression(
        pattern: "(?<![a-z])(used (for|at)|approved|authori[sz]ed|paid|payment|received|refund(ed)?|debit(ed)?|credit(ed)?|purchase|spent|withdr(awn|awal)|transfer(red)?|deposit(ed)?|charged|sent)(?![a-z])",
        options: .caseInsensitive)
    private static let marketing = try! NSRegularExpression(
        pattern: "(?<![a-z])(promo(tion)?|promo code|coupon|discount|\\d+\\s?% ?off|limited offer|special offer|exclusive offer|unsubscribe|reply stop|win a|free gift|flash sale)(?![a-z])",
        options: .caseInsensitive)
    private static let marketingArabic = ["عرض خاص", "خصم حصري", "كوبون", "اشترك الآن", "للإلغاء أرسل"]
    private static let moneyVerbArabic = ["تمت عملية", "اعتماد", "تم الدفع", "دفع", "خصم", "تحويل", "شراء", "سحب", "إيداع", "استلام", "استرداد"]
    private static let otpArabic = ["رمز التحقق", "كلمة المرور المؤقتة", "رمز التفعيل", "لا تشارك"]
    private static let txnArabic = ["تم خصم", "تم سحب", "تم دفع", "عملية شراء", "تم إيداع", "تم إضافة"]

    private static func matches(_ r: NSRegularExpression, _ s: String) -> Bool {
        r.firstMatch(in: s, range: NSRange(s.startIndex..., in: s)) != nil
    }

    /// An amount with a currency AND a verb for money that moved; "never share" boilerplate alone is not an OTP.
    static func carriesMoneyMovement(_ message: String) -> Bool {
        if matches(txn, message) || txnArabic.contains(where: { message.contains($0) }) { return true }
        let hasAmount = matches(currency, message) || (message.contains("جنيه") && message.contains(where: { $0.isNumber }))
        return hasAmount && (matches(moneyVerb, message) || moneyVerbArabic.contains { message.contains($0) })
    }

    static func shouldDrop(_ message: String) -> Bool {
        let isOtp = matches(otp, message) || otpArabic.contains { message.contains($0) }
        let isMarketing = matches(marketing, message) || marketingArabic.contains { message.contains($0) }
        return (isOtp || isMarketing) && !carriesMoneyMovement(message)
    }
}
