import Foundation
import Capacitor

/// iOS twin of the Android SmsCapacitorPlugin. iOS cannot read SMS directly,
/// so the permission methods are granted no-ops; saveToken/setEnabled persist
/// the ingest credentials for CatchBankSmsIntent (the Shortcuts automation
/// bridge), and healthCheck exercises the exact send path the intent uses.
@objc(SmsCapacitorPluginIOS)
public class SmsCapacitorPlugin: CAPInstancePlugin, CAPBridgedPlugin {
    public let identifier = "SmsCapacitorPlugin"
    public let jsName = "SmsCapacitorPlugin"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "checkPermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestPermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "saveToken", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setEnabled", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setSetupCompleted", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setForwardMode", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearState", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "healthCheck", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "peekPendingQueue", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "removePending", returnType: CAPPluginReturnPromise)
    ]

    @objc func checkPermission(_ call: CAPPluginCall) { call.resolve(["granted": true]) }
    @objc func requestPermission(_ call: CAPPluginCall) { call.resolve(["granted": true]) }

    @objc func saveToken(_ call: CAPPluginCall) {
        guard let token = call.getString("token"), let apiUrl = call.getString("apiUrl") else {
            call.reject("token and apiUrl are required")
            return
        }
        SmsCredentialStore.save(token: token, apiUrl: apiUrl)
        call.resolve()
    }

    @objc func setEnabled(_ call: CAPPluginCall) {
        SmsCredentialStore.setEnabled(call.getBool("enabled") ?? false)
        call.resolve()
    }

    /// Set true when the user finishes the Shortcut setup guide — gates the
    /// on/off switch's visibility on iOS.
    @objc func setSetupCompleted(_ call: CAPPluginCall) {
        SmsCredentialStore.setSetupCompleted(call.getBool("completed") ?? false)
        call.resolve()
    }

    /// No-op on iOS (the Shortcut catches everything; there's no on-device gate).
    /// Present for bridge parity with Android so the JS layer can call it freely.
    @objc func setForwardMode(_ call: CAPPluginCall) { call.resolve() }

    /// Sign-out / account switch: wipe per-device SMS state so the next user starts OFF.
    @objc func clearState(_ call: CAPPluginCall) {
        SmsCredentialStore.clear()
        call.resolve()
    }

    @objc func getStatus(_ call: CAPPluginCall) {
        call.resolve([
            "tokenSaved": SmsCredentialStore.token != nil,
            "enabled": SmsCredentialStore.isEnabled,
            "setupCompleted": SmsCredentialStore.isSetupCompleted,
            "permission": true,
            "lastRunAt": SmsCredentialStore.lastRunAt ?? "",
            "lastResult": SmsCredentialStore.lastResult ?? "",
            "pendingCount": SmsCredentialStore.pendingCount
        ])
    }

    /// Returns queued SMS without clearing — the queue stays authoritative.
    @objc func peekPendingQueue(_ call: CAPPluginCall) {
        call.resolve(["items": SmsCredentialStore.peekPending()])
    }

    /// Removes items the server confirmed (or permanently rejected) during a drain.
    @objc func removePending(_ call: CAPPluginCall) {
        let items = (call.getArray("items") as? [[String: String]]) ?? []
        SmsCredentialStore.removePending(items)
        call.resolve()
    }

    @objc func healthCheck(_ call: CAPPluginCall) {
        guard let token = SmsCredentialStore.token, let base = SmsCredentialStore.apiUrl,
              let url = URL(string: base + "/api/sms/health") else {
            call.resolve(["ok": false, "status": 0, "tokenSaved": false])
            return
        }
        var req = URLRequest(url: url)
        req.httpMethod = "GET"
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.timeoutInterval = 15
        URLSession.shared.dataTask(with: req) { _, response, _ in
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            call.resolve(["ok": status == 200, "status": status, "tokenSaved": true])
        }.resume()
    }
}

/// Shared between the Capacitor plugin and CatchBankSmsIntent — both run in
/// the app process, so plain UserDefaults.standard works (no App Group).
enum SmsCredentialStore {
    private static let tokenKey = "buddget.sms.ingest_token"
    private static let apiUrlKey = "buddget.sms.api_url"
    private static let enabledKey = "buddget.sms.enabled"
    private static let setupCompletedKey = "buddget.sms.setup_completed"
    private static let lastRunAtKey = "buddget.sms.last_run_at"
    private static let lastResultKey = "buddget.sms.last_result"
    private static let pendingQueueKey = "buddget.sms.pending_queue"

    /// Serializes queue read-modify-write: CatchBankSmsIntent (Swift-concurrency
    /// thread) and the Capacitor bridge queue mutate the same UserDefaults array;
    /// an unlocked interleave could drop a freshly-enqueued SMS.
    private static let queueLock = NSLock()

    static func enqueuePending(message: String, sender: String, receivedAt: String) {
        queueLock.lock(); defer { queueLock.unlock() }
        let d = UserDefaults.standard
        var queue = (d.array(forKey: pendingQueueKey) as? [[String: String]]) ?? []
        queue.append(["message": message, "sender": sender, "receivedAt": receivedAt, "source": "sms"])
        if queue.count > 50 { queue = Array(queue.suffix(50)) }
        d.set(queue, forKey: pendingQueueKey)
    }

    static func peekPending() -> [[String: String]] {
        queueLock.lock(); defer { queueLock.unlock() }
        return (UserDefaults.standard.array(forKey: pendingQueueKey) as? [[String: String]]) ?? []
    }

    static func removePending(_ items: [[String: String]]) {
        guard !items.isEmpty else { return }
        queueLock.lock(); defer { queueLock.unlock() }
        let d = UserDefaults.standard
        var queue = (d.array(forKey: pendingQueueKey) as? [[String: String]]) ?? []
        for item in items {
            if let idx = queue.firstIndex(where: {
                $0["message"] == item["message"] && $0["receivedAt"] == item["receivedAt"]
            }) {
                queue.remove(at: idx)
            }
        }
        d.set(queue, forKey: pendingQueueKey)
    }

    static var pendingCount: Int {
        queueLock.lock(); defer { queueLock.unlock() }
        return ((UserDefaults.standard.array(forKey: pendingQueueKey) as? [[String: String]]) ?? []).count
    }

    static func save(token: String, apiUrl: String) {
        let d = UserDefaults.standard
        d.set(token, forKey: tokenKey)
        d.set(apiUrl, forKey: apiUrlKey)
    }

    static func setEnabled(_ enabled: Bool) {
        UserDefaults.standard.set(enabled, forKey: enabledKey)
    }

    static func setSetupCompleted(_ completed: Bool) {
        UserDefaults.standard.set(completed, forKey: setupCompletedKey)
    }

    static func clear() {
        let d = UserDefaults.standard
        d.removeObject(forKey: tokenKey)
        d.removeObject(forKey: apiUrlKey)
        d.set(false, forKey: enabledKey)
        d.set(false, forKey: setupCompletedKey)
        d.removeObject(forKey: pendingQueueKey)
    }

    static func recordRun(result: String) {
        let d = UserDefaults.standard
        d.set(ISO8601DateFormatter().string(from: Date()), forKey: lastRunAtKey)
        d.set(result, forKey: lastResultKey)
    }

    static var token: String? { UserDefaults.standard.string(forKey: tokenKey) }
    static var apiUrl: String? { UserDefaults.standard.string(forKey: apiUrlKey) }
    static var isEnabled: Bool { UserDefaults.standard.bool(forKey: enabledKey) }
    static var isSetupCompleted: Bool { UserDefaults.standard.bool(forKey: setupCompletedKey) }
    static var lastRunAt: String? { UserDefaults.standard.string(forKey: lastRunAtKey) }
    static var lastResult: String? { UserDefaults.standard.string(forKey: lastResultKey) }
}
