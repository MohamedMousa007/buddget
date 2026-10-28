import Foundation
import Capacitor
import Security

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
        CAPPluginMethod(name: "clearCredentials", returnType: CAPPluginReturnPromise),
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
        SmsCredentialStore.save(token: token, apiUrl: apiUrl, userId: call.getString("userId") ?? "")
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

    /// Account switch: drop the stored ingest token/owner + disarm, but KEEP the
    /// device capability (setupCompleted/lastRunAt/queue) so the switch never
    /// regresses to the setup CTA and another account's queued SMS survive.
    @objc func clearCredentials(_ call: CAPPluginCall) {
        SmsCredentialStore.clearCredentials()
        call.resolve()
    }

    /// Full device wipe (fresh install / forget device): also clears the device
    /// capability + queue so the next user starts from the setup CTA.
    @objc func clearState(_ call: CAPPluginCall) {
        SmsCredentialStore.clear()
        call.resolve()
    }

    @objc func getStatus(_ call: CAPPluginCall) {
        call.resolve([
            "tokenSaved": SmsCredentialStore.token != nil,
            "enabled": SmsCredentialStore.isEnabled,
            "setupCompleted": SmsCredentialStore.isSetupCompleted,
            "wired": SmsCredentialStore.isWired,
            "tokenUserId": SmsCredentialStore.tokenUserId ?? "",
            "permission": true,
            "lastRunAt": SmsCredentialStore.lastRunAt ?? "",
            "lastResult": SmsCredentialStore.lastResult ?? "",
            "pendingCount": SmsCredentialStore.pendingCount,
            "evictedCount": SmsCredentialStore.evictedCount,
            "oldestPendingAt": SmsCredentialStore.oldestPendingAt ?? ""
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

/// Keychain wrapper for the ingest token and pending-SMS queue. AfterFirstUnlock
/// so the Shortcut-driven intent can read it while the phone is locked;
/// ThisDeviceOnly keeps it out of iCloud/iTunes backups and device transfers.
private enum SmsKeychain {
    private static let service = "app.buddget.sms"

    private static func query(_ account: String) -> [String: Any] {
        [kSecClass as String: kSecClassGenericPassword,
         kSecAttrService as String: service,
         kSecAttrAccount as String: account]
    }

    static func read(_ account: String) -> Data? {
        var q = query(account)
        q[kSecReturnData as String] = true
        q[kSecMatchLimit as String] = kSecMatchLimitOne
        var out: AnyObject?
        guard SecItemCopyMatching(q as CFDictionary, &out) == errSecSuccess else { return nil }
        return out as? Data
    }

    enum ReadResult {
        case found(Data)
        case missing
        /// Keychain refused (e.g. before first unlock): the item may exist, so callers must not overwrite it.
        case unavailable
    }

    static func readResult(_ account: String) -> ReadResult {
        var q = query(account)
        q[kSecReturnData as String] = true
        q[kSecMatchLimit as String] = kSecMatchLimitOne
        var out: AnyObject?
        switch SecItemCopyMatching(q as CFDictionary, &out) {
        case errSecSuccess:
            if let data = out as? Data { return .found(data) }
            return .unavailable
        case errSecItemNotFound: return .missing
        default: return .unavailable
        }
    }

    @discardableResult
    static func write(_ account: String, _ data: Data) -> Bool {
        let update = [kSecValueData as String: data]
        if SecItemUpdate(query(account) as CFDictionary, update as CFDictionary) == errSecSuccess { return true }
        var add = query(account)
        add[kSecValueData as String] = data
        add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        let status = SecItemAdd(add as CFDictionary, nil)
        if status == errSecDuplicateItem {
            return SecItemUpdate(query(account) as CFDictionary, update as CFDictionary) == errSecSuccess
        }
        return status == errSecSuccess
    }

    static func delete(_ account: String) {
        SecItemDelete(query(account) as CFDictionary)
    }
}

/// Shared between the Capacitor plugin and CatchBankSmsIntent — both run in
/// the app process, so plain UserDefaults.standard works (no App Group) for the
/// non-secret flags. The ingest token and the pending queue (raw bank SMS text)
/// live in the Keychain; values an older build left in UserDefaults are moved
/// across once and removed.
/// CONSTRAINT: CatchBankSmsIntent must stay in the main app target. Moving it to
/// an App Intents Extension gives it a separate UserDefaults container, and the
/// pending queue — the only thing standing between a killed intent and a lost
/// transaction — would silently stop reaching the drain. Add an App Group first.
enum SmsCredentialStore {
    private static let tokenKey = "buddget.sms.ingest_token"
    private static let tokenUserIdKey = "buddget.sms.token_user_id"
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
    private static let queueCap = 200
    private static let evictedKey = "buddget.sms.evicted_count"

    private static let tokenAccount = "ingest_token"
    private static let queueAccount = "pending_queue"

    private static let migrated: Void = {
        let d = UserDefaults.standard
        if let legacyToken = d.string(forKey: tokenKey) {
            if moveToKeychain(tokenAccount, legacyToken.data(using: .utf8)) { d.removeObject(forKey: tokenKey) }
        }
        if let legacyQueue = d.array(forKey: pendingQueueKey) as? [[String: String]] {
            if moveToKeychain(queueAccount, try? JSONSerialization.data(withJSONObject: legacyQueue)) {
                d.removeObject(forKey: pendingQueueKey)
            }
        }
    }()

    /// True when the legacy value is safely in the Keychain (written now or already there) and may be removed.
    private static func moveToKeychain(_ account: String, _ data: Data?) -> Bool {
        switch SmsKeychain.readResult(account) {
        case .found: return true
        case .unavailable: return false
        case .missing:
            guard let data else { return false }
            return SmsKeychain.write(account, data)
        }
    }

    /// nil = Keychain unavailable right now (the stored queue may exist): never write over it.
    /// Callers hold queueLock.
    private static func readQueue() -> [[String: String]]? {
        _ = migrated
        switch SmsKeychain.readResult(queueAccount) {
        case .missing: return []
        case .unavailable: return nil
        case .found(let data):
            return (try? JSONSerialization.jsonObject(with: data) as? [[String: String]]) ?? []
        }
    }

    /// Callers hold queueLock.
    private static func writeQueue(_ queue: [[String: String]]) {
        if queue.isEmpty { SmsKeychain.delete(queueAccount); return }
        if let data = try? JSONSerialization.data(withJSONObject: queue) { SmsKeychain.write(queueAccount, data) }
    }

    static var evictedCount: Int { UserDefaults.standard.integer(forKey: evictedKey) }

    /// receivedAt of the oldest queued SMS (backlog age); nil when the queue is empty.
    static var oldestPendingAt: String? {
        queueLock.lock(); defer { queueLock.unlock() }
        return (readQueue() ?? []).compactMap { $0["receivedAt"] }.min()
    }

    static func enqueuePending(message: String, sender: String, receivedAt: String, userId: String, eventId: String = "") {
        queueLock.lock(); defer { queueLock.unlock() }
        let d = UserDefaults.standard
        guard var queue = readQueue() else { return }
        // Stamp the owning account so an account switch can't drain this SMS into
        // the wrong user (the JS drain filters by userId before POSTing).
        queue.append(["message": message, "sender": sender, "receivedAt": receivedAt, "source": "sms", "userId": userId, "eventId": eventId])
        if queue.count > queueCap {
            let overflow = queue.count - queueCap
            queue = Array(queue.suffix(queueCap))
            d.set(d.integer(forKey: evictedKey) + overflow, forKey: evictedKey)
        }
        writeQueue(queue)
    }

    static func peekPending() -> [[String: String]] {
        queueLock.lock(); defer { queueLock.unlock() }
        return readQueue() ?? []
    }

    static func removePending(_ items: [[String: String]]) {
        guard !items.isEmpty else { return }
        queueLock.lock(); defer { queueLock.unlock() }
        guard var queue = readQueue() else { return }
        for item in items {
            if let idx = queue.firstIndex(where: {
                if let id = item["eventId"], !id.isEmpty, $0["eventId"] != nil { return $0["eventId"] == id }
                return $0["message"] == item["message"] && $0["receivedAt"] == item["receivedAt"]
            }) {
                queue.remove(at: idx)
            }
        }
        writeQueue(queue)
    }

    static var pendingCount: Int {
        queueLock.lock(); defer { queueLock.unlock() }
        return readQueue()?.count ?? 0
    }

    static func save(token: String, apiUrl: String, userId: String) {
        _ = migrated
        SmsKeychain.write(tokenAccount, Data(token.utf8))
        let d = UserDefaults.standard
        d.set(apiUrl, forKey: apiUrlKey)
        d.set(userId, forKey: tokenUserIdKey)
    }

    static func setEnabled(_ enabled: Bool) {
        UserDefaults.standard.set(enabled, forKey: enabledKey)
    }

    static func setSetupCompleted(_ completed: Bool) {
        UserDefaults.standard.set(completed, forKey: setupCompletedKey)
    }

    /// Account switch: forget the token/owner and disarm. Preserves setupCompleted,
    /// lastRunAt and the pending queue — the Shortcut still physically exists here,
    /// and the previous account's undelivered SMS wait for that user to return.
    static func clearCredentials() {
        let d = UserDefaults.standard
        SmsKeychain.delete(tokenAccount)
        d.removeObject(forKey: tokenKey)
        d.removeObject(forKey: apiUrlKey)
        d.removeObject(forKey: tokenUserIdKey)
        d.set(false, forKey: enabledKey)
    }

    static func clear() {
        let d = UserDefaults.standard
        SmsKeychain.delete(tokenAccount)
        d.removeObject(forKey: tokenKey)
        d.removeObject(forKey: apiUrlKey)
        d.removeObject(forKey: tokenUserIdKey)
        d.set(false, forKey: enabledKey)
        d.set(false, forKey: setupCompletedKey)
        queueLock.lock(); defer { queueLock.unlock() }
        SmsKeychain.delete(queueAccount)
        d.removeObject(forKey: pendingQueueKey)
    }

    static func recordRun(result: String) {
        let d = UserDefaults.standard
        d.set(ISO8601DateFormatter().string(from: Date()), forKey: lastRunAtKey)
        d.set(result, forKey: lastResultKey)
    }

    static var token: String? {
        _ = migrated
        return SmsKeychain.read(tokenAccount).flatMap { String(data: $0, encoding: .utf8) }
    }
    static var tokenUserId: String? { UserDefaults.standard.string(forKey: tokenUserIdKey) }
    static var apiUrl: String? { UserDefaults.standard.string(forKey: apiUrlKey) }
    static var isEnabled: Bool { UserDefaults.standard.bool(forKey: enabledKey) }
    static var isSetupCompleted: Bool { UserDefaults.standard.bool(forKey: setupCompletedKey) }
    /// The device capability: a Shortcut physically exists here. True once setup
    /// finished, the bridge ever fired, or a token is stored. Survives account
    /// switches (clearCredentials keeps setupCompleted + lastRunAt).
    static var isWired: Bool { isSetupCompleted || lastRunAt != nil || token != nil }
    static var lastRunAt: String? { UserDefaults.standard.string(forKey: lastRunAtKey) }
    static var lastResult: String? { UserDefaults.standard.string(forKey: lastResultKey) }
}
