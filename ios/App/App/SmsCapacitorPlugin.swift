import Foundation
import Capacitor
import Security
import BackgroundTasks

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
        CAPPluginMethod(name: "setDeviceSecret", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getDeviceSecret", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "removeDeviceSecret", returnType: CAPPluginReturnPromise),
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
        guard SmsApiUrl.isAllowed(apiUrl) else {
            call.reject("apiUrl not allowed")
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

    /// Trusted-device secret, in the same Keychain service as the ingest token (AfterFirstUnlockThisDeviceOnly: no backup, no transfer).
    /// clearCredentials and clearState leave it alone.
    @objc func setDeviceSecret(_ call: CAPPluginCall) {
        guard let secret = call.getString("secret"), SmsKeychain.write("device_secret", Data(secret.utf8)) else {
            call.reject("secret could not be stored")
            return
        }
        call.resolve()
    }

    @objc func getDeviceSecret(_ call: CAPPluginCall) {
        let secret = SmsKeychain.read("device_secret").flatMap { String(data: $0, encoding: .utf8) }
        if let secret { call.resolve(["secret": secret]) } else { call.resolve(["secret": NSNull()]) }
    }

    @objc func removeDeviceSecret(_ call: CAPPluginCall) {
        SmsKeychain.delete("device_secret")
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

/// The only origins the SMS bridge may send a bank SMS and its ingest token to. The URL arrives from JS, so script
/// running in the WebView must not be able to repoint it: https on buddget.app (or a subdomain), mirroring
/// capacitor.config.ts `allowNavigation`; http://localhost only in DEBUG builds.
enum SmsApiUrl {
    private static let host = "buddget.app"

    static func isAllowed(_ raw: String?) -> Bool {
        guard let raw = raw?.trimmingCharacters(in: .whitespacesAndNewlines), !raw.isEmpty,
              let c = URLComponents(string: raw), let h = c.host?.lowercased(), !h.isEmpty,
              c.user == nil, c.password == nil, c.query == nil, c.fragment == nil,
              c.path.isEmpty || c.path == "/" else { return false }
        switch c.scheme?.lowercased() {
        case "https":
            return (c.port == nil || c.port == 443) && (h == host || h.hasSuffix("." + host))
        case "http":
            #if DEBUG
            return h == "localhost" || h == "127.0.0.1"
            #else
            return false
            #endif
        default:
            return false
        }
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
            if mergeLegacyQueue(legacyQueue) { d.removeObject(forKey: pendingQueueKey) }
        }
    }()

    private static func sameItem(_ a: [String: String], _ b: [String: String]) -> Bool {
        if let x = a["eventId"], !x.isEmpty, let y = b["eventId"], !y.isEmpty { return x == y }
        return a["message"] == b["message"] && a["receivedAt"] == b["receivedAt"]
    }

    /// Adds `extra` to `base`, skipping anything already there.
    private static func merged(_ base: [[String: String]], _ extra: [[String: String]]) -> [[String: String]] {
        var out = base
        for item in extra where !out.contains(where: { sameItem($0, item) }) { out.append(item) }
        return out
    }

    /// True when every legacy item is safely in the Keychain queue. A queue already there is merged with, never kept
    /// instead of, the legacy one: an SMS enqueued before migration ran must not be deleted with the legacy key.
    private static func mergeLegacyQueue(_ legacy: [[String: String]]) -> Bool {
        switch SmsKeychain.readResult(queueAccount) {
        case .unavailable: return false
        case .missing:
            guard let data = try? JSONSerialization.data(withJSONObject: legacy) else { return false }
            return SmsKeychain.write(queueAccount, data)
        case .found(let data):
            let current = (try? JSONSerialization.jsonObject(with: data)) as? [[String: String]] ?? []
            guard let out = try? JSONSerialization.data(withJSONObject: merged(current, legacy)) else { return false }
            return SmsKeychain.write(queueAccount, out)
        }
    }

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
            if let queue = (try? JSONSerialization.jsonObject(with: data)) as? [[String: String]] { return mergeSpill(into: queue) }
            // Unreadable blob: keep it aside for recovery before the next write replaces it.
            _ = SmsKeychain.write(queueAccount + "_unreadable", data)
            return mergeSpill(into: [])
        }
    }

    /// SMS that arrived while the Keychain could not be read (before first unlock, for instance) wait here.
    private static let spillKey = "buddget.sms.pending_spill"

    private static func mergeSpill(into queue: [[String: String]]) -> [[String: String]] {
        let d = UserDefaults.standard
        guard let spill = d.array(forKey: spillKey) as? [[String: String]], !spill.isEmpty else { return queue }
        let out = merged(queue, spill)
        if let data = try? JSONSerialization.data(withJSONObject: out), SmsKeychain.write(queueAccount, data) {
            d.removeObject(forKey: spillKey)
        }
        return out
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
        let entry = ["message": message, "sender": sender, "receivedAt": receivedAt, "source": "sms", "userId": userId, "eventId": eventId]
        guard var queue = readQueue() else {
            // Keychain unreadable right now: park the SMS in the spill list instead of dropping it.
            d.set(((d.array(forKey: spillKey) as? [[String: String]]) ?? []) + [entry], forKey: spillKey)
            return
        }
        // Stamp the owning account so an account switch can't drain this SMS into
        // the wrong user (the JS drain filters by userId before POSTing).
        queue.append(entry)
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
    /// Only an allow-listed origin is ever returned, so a value written by an older build is never posted to.
    static var apiUrl: String? { UserDefaults.standard.string(forKey: apiUrlKey).flatMap { SmsApiUrl.isAllowed($0) ? $0 : nil } }
    static var isEnabled: Bool { UserDefaults.standard.bool(forKey: enabledKey) }
    static var isSetupCompleted: Bool { UserDefaults.standard.bool(forKey: setupCompletedKey) }
    /// The device capability: a Shortcut physically exists here. True once setup
    /// finished, the bridge ever fired, or a token is stored. Survives account
    /// switches (clearCredentials keeps setupCompleted + lastRunAt).
    static var isWired: Bool { isSetupCompleted || lastRunAt != nil || token != nil }
    static var lastRunAt: String? { UserDefaults.standard.string(forKey: lastRunAtKey) }
    static var lastResult: String? { UserDefaults.standard.string(forKey: lastResultKey) }
}

/// Retries queued SMS while the app is closed. The Shortcut makes one 15 second attempt; without this a message that
/// failed or was refused waited until the user next opened the app. iOS decides when the task runs (typically when the
/// phone is idle on a network), so this is a safety net on top of the app-open drain, not a timer.
enum SmsBackgroundDrain {
    static let identifier = "app.buddget.sms-drain"
    private static let earliestDelay: TimeInterval = 15 * 60

    /// Must run before the app finishes launching (AppDelegate).
    static func register() {
        BGTaskScheduler.shared.register(forTaskWithIdentifier: identifier, using: nil) { task in
            guard let task = task as? BGProcessingTask else { task.setTaskCompleted(success: false); return }
            handle(task)
        }
    }

    /// Asks iOS for a drain slot while anything is still queued. Safe to call repeatedly.
    static func scheduleIfPending() {
        guard SmsCredentialStore.pendingCount > 0 else { return }
        let request = BGProcessingTaskRequest(identifier: identifier)
        request.requiresNetworkConnectivity = true
        request.requiresExternalPower = false
        request.earliestBeginDate = Date(timeIntervalSinceNow: earliestDelay)
        try? BGTaskScheduler.shared.submit(request)
    }

    private static func handle(_ task: BGProcessingTask) {
        let work = Task {
            let finished = await drain()
            scheduleIfPending() // anything still queued asks for the next slot
            task.setTaskCompleted(success: finished)
        }
        task.expirationHandler = { work.cancel() }
    }

    /// Posts every queued SMS this account owns with the stored ingest token. An item leaves the queue only on a 2xx that is
    /// not 202; the server de-duplicates by eventId, so a drain racing the app's own is harmless.
    private static func drain() async -> Bool {
        guard let token = SmsCredentialStore.token,
              let userId = SmsCredentialStore.tokenUserId, !userId.isEmpty,
              let base = SmsCredentialStore.apiUrl,
              let url = URL(string: base + "/api/sms/parse") else { return false }
        for item in SmsCredentialStore.peekPending() {
            if Task.isCancelled { return false }
            let owner = item["userId"] ?? ""
            guard owner.isEmpty || owner == userId, let message = item["message"], let receivedAt = item["receivedAt"] else { continue }
            var payload: [String: Any] = ["message": message, "sender": item["sender"] ?? "", "source": "sms", "receivedAt": receivedAt]
            if let eventId = item["eventId"], !eventId.isEmpty { payload["eventId"] = eventId }
            guard let body = try? JSONSerialization.data(withJSONObject: payload) else { continue }
            var req = URLRequest(url: url)
            req.httpMethod = "POST"
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            if let eventId = item["eventId"], !eventId.isEmpty { req.setValue(eventId, forHTTPHeaderField: "x-sms-event-id") }
            req.timeoutInterval = 20
            req.httpBody = body
            guard let (_, response) = try? await URLSession.shared.data(for: req), let http = response as? HTTPURLResponse else { return false }
            let code = http.statusCode
            if (200..<300).contains(code) && code != 202 {
                SmsCredentialStore.removePending([item])
                SmsCredentialStore.recordRun(result: "delivered")
            } else if code == 202 || code == 401 || code == 403 || code == 408 || code == 429 || code >= 500 {
                return false // the rest would fail the same way; they stay queued
            }
            // any other 4xx belongs to this one message: it stays queued and the next one goes
        }
        return true
    }
}
