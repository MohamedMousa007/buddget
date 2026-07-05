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
        guard SmsCredentialStore.isEnabled,
              let token = SmsCredentialStore.token,
              let base = SmsCredentialStore.apiUrl,
              let url = URL(string: base + "/api/sms/parse") else {
            return .result()
        }

        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.timeoutInterval = 20
        req.httpBody = try JSONSerialization.data(withJSONObject: [
            "message": message,
            "sender": sender ?? "",
            "source": "sms"
        ])

        // One retry after a short backoff — Shortcuts automations never retry,
        // so a single network blip must not lose the transaction.
        var delivered = await send(req)
        if !delivered {
            try? await Task.sleep(nanoseconds: 2_000_000_000)
            delivered = await send(req)
        }
        // If still offline after retry, persist for drain on next app open.
        if !delivered {
            SmsCredentialStore.enqueuePending(
                message: message,
                sender: sender ?? "",
                receivedAt: ISO8601DateFormatter().string(from: Date())
            )
        }
        SmsCredentialStore.recordRun(result: delivered ? "delivered" : "failed")
        return .result()
    }

    private func send(_ req: URLRequest) async -> Bool {
        guard let (_, response) = try? await URLSession.shared.data(for: req),
              let http = response as? HTTPURLResponse else { return false }
        return (200..<300).contains(http.statusCode)
    }
}
