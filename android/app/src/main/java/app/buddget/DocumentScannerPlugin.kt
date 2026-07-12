package app.buddget

import android.app.Activity
import android.content.Intent
import android.util.Base64
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.google.mlkit.vision.documentscanner.GmsDocumentScannerOptions
import com.google.mlkit.vision.documentscanner.GmsDocumentScanning
import com.google.mlkit.vision.documentscanner.GmsDocumentScanningResult

/**
 * Native receipt scanner backed by ML Kit's document scanner (auto edge-detect,
 * perspective correction, manual crop, multi-page, gallery import). Returns
 * base64 JPEGs — one per page — matching the iOS VisionKit plugin's contract.
 */
@CapacitorPlugin(name = "DocumentScanner")
class DocumentScannerPlugin : Plugin() {

    private var pendingCall: PluginCall? = null
    private var scanRequestCode = 0

    @PluginMethod
    fun isAvailable(call: PluginCall) {
        // The scanner ships as an on-demand Play Services module that downloads on
        // first use; there's no synchronous availability API, so report true and
        // let a real failure surface on scan() (JS falls back to @capacitor/camera).
        call.resolve(JSObject().apply { put("available", true) })
    }

    @PluginMethod
    fun scan(call: PluginCall) {
        val activity: Activity = activity ?: run { call.reject("no activity"); return }
        val pageLimit = call.getInt("pageLimit") ?: 5

        val scanner = GmsDocumentScanning.getClient(baseOptions(pageLimit))
        scanner.getStartScanIntent(activity)
            .addOnSuccessListener { intentSender ->
                try {
                    pendingCall = call
                    scanRequestCode = REQ_SCAN
                    // ML Kit hands back an IntentSender (not an Intent), so Capacitor's
                    // startActivityForResult can't launch it — go through the Activity.
                    activity.startIntentSenderForResult(intentSender, REQ_SCAN, null, 0, 0, 0)
                } catch (e: Exception) {
                    pendingCall = null
                    call.reject(e.message ?: "Could not open scanner")
                }
            }
            .addOnFailureListener { e ->
                call.reject(e.message ?: "Scanner unavailable")
            }
    }

    // Capacitor has no first-class launcher for IntentSender results (ML Kit hands
    // back an IntentSender, not an Intent), so the raw activity-result override is
    // the sanctioned path here.
    @Suppress("DEPRECATION")
    @Deprecated("Uses Bridge.handleOnActivityResult for IntentSender results")
    override fun handleOnActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.handleOnActivityResult(requestCode, resultCode, data)
        if (requestCode != REQ_SCAN) return
        val call = pendingCall ?: return
        pendingCall = null

        if (resultCode == Activity.RESULT_CANCELED) {
            call.reject("cancelled")
            return
        }
        if (resultCode != Activity.RESULT_OK) {
            call.reject("Scan failed")
            return
        }

        val result = GmsDocumentScanningResult.fromActivityResultIntent(data)
        val pages = result?.pages
        if (pages.isNullOrEmpty()) {
            call.reject("No pages scanned")
            return
        }

        val images = JSArray()
        for (page in pages) {
            val bytes = context.contentResolver.openInputStream(page.imageUri)?.use { it.readBytes() }
            if (bytes != null) images.put(Base64.encodeToString(bytes, Base64.NO_WRAP))
        }
        call.resolve(JSObject().apply { put("images", images) })
    }

    private fun baseOptions(pageLimit: Int): GmsDocumentScannerOptions =
        GmsDocumentScannerOptions.Builder()
            .setGalleryImportAllowed(true)
            .setPageLimit(pageLimit)
            .setResultFormats(GmsDocumentScannerOptions.RESULT_FORMAT_JPEG)
            .setScannerMode(GmsDocumentScannerOptions.SCANNER_MODE_FULL)
            .build()

    private companion object {
        const val REQ_SCAN = 0xD0C5
    }
}
