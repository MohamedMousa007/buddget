import AppIntents
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

    @Parameter(title: "Sender", default: "")
    var sender: String?

    static var parameterSummary: some ParameterSummary {
        Summary("Catch \(\.$message) from \(\.$sender)")
    }

    func perform() async throws -> some IntentResult {
        // Stamp that the Shortcut fired BEFORE the enable gate — this is the only
        // on-device proof the automation exists (iOS exposes no API to enumerate
        // Shortcuts), so it must be recorded even when tracking is off, feeding
        // the "wired" capability that gates the Settings switch vs. setup CTA.
        SmsCredentialStore.recordRun(result: "detected")
        guard SmsCredentialStore.isEnabled else { return .result() }

        // Ledger-first, mirroring Android's SmsReceiver/SmsForwardWorker split: the
        // SMS is durable BEFORE any network work, and delivery only ever REMOVES it.
        // The automation runs perform() inside a finite background window, and two
        // SMS in the same second run two of them inside that one window — whichever
        // loses the race is killed mid-flight. Sending first meant that kill landed
        // between "SMS arrived" and "enqueue on failure", losing the transaction with
        // no trace on the device or the server. Enqueueing first turns that same kill
        // into a delay: the app-open drain replays whatever is still queued.
        let receivedAt = ISO8601DateFormatter().string(from: Date())
        let from = sender ?? ""
        SmsCredentialStore.enqueuePending(message: message, sender: from, receivedAt: receivedAt,
                                          userId: SmsCredentialStore.tokenUserId ?? "")

        guard let token = SmsCredentialStore.token,
              let base = SmsCredentialStore.apiUrl,
              let url = URL(string: base + "/api/sms/parse") else {
            SmsCredentialStore.recordRun(result: "no_token")
            return .result()
        }

        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
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
            "receivedAt": receivedAt
        ])

        if await send(req) {
            SmsCredentialStore.removePending([["message": message, "receivedAt": receivedAt]])
            SmsCredentialStore.recordRun(result: "delivered")
        } else {
            SmsCredentialStore.recordRun(result: "queued")
        }
        return .result()
    }

    private func send(_ req: URLRequest) async -> Bool {
        guard let (_, response) = try? await URLSession.shared.data(for: req),
              let http = response as? HTTPURLResponse else { return false }
        return (200..<300).contains(http.statusCode)
    }
}
