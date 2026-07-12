package app.buddget

import android.app.Activity
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.media.ExifInterface
import android.util.Base64
import androidx.activity.ComponentActivity
import androidx.activity.result.ActivityResult
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.IntentSenderRequest
import androidx.activity.result.contract.ActivityResultContracts
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.google.mlkit.vision.documentscanner.GmsDocumentScannerOptions
import com.google.mlkit.vision.documentscanner.GmsDocumentScanning
import com.google.mlkit.vision.documentscanner.GmsDocumentScanningResult
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream

/**
 * Native receipt scanner backed by ML Kit's document scanner (auto edge-detect,
 * perspective correction, manual crop, multi-page, gallery import). Returns
 * base64 JPEGs — one per page — matching the iOS VisionKit plugin's contract.
 */
@CapacitorPlugin(name = "DocumentScanner")
class DocumentScannerPlugin : Plugin() {

    private var pendingCall: PluginCall? = null
    private lateinit var scanLauncher: ActivityResultLauncher<IntentSenderRequest>

    override fun load() {
        // Register the result callback up front. ML Kit returns an IntentSender
        // (not an Intent), so this is the only reliable way to get the result
        // back — launching it raw bypasses Capacitor's routing and the promise
        // would hang forever ("Opening scanner…").
        scanLauncher = (activity as ComponentActivity).registerForActivityResult(
            ActivityResultContracts.StartIntentSenderForResult()
        ) { result -> onScanResult(result) }
    }

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
                pendingCall = call
                try {
                    scanLauncher.launch(IntentSenderRequest.Builder(intentSender).build())
                } catch (e: Exception) {
                    pendingCall = null
                    call.reject(e.message ?: "Could not open scanner")
                }
            }
            .addOnFailureListener { e ->
                call.reject(e.message ?: "Scanner unavailable")
            }
    }

    private fun onScanResult(result: ActivityResult) {
        val call = pendingCall ?: return
        pendingCall = null

        if (result.resultCode == Activity.RESULT_CANCELED) {
            call.reject("cancelled")
            return
        }
        if (result.resultCode != Activity.RESULT_OK) {
            call.reject("Scan failed")
            return
        }

        val scan = GmsDocumentScanningResult.fromActivityResultIntent(result.data)
        val pages = scan?.pages
        if (pages.isNullOrEmpty()) {
            call.reject("No pages scanned")
            return
        }

        val images = JSArray()
        for (page in pages) {
            val bytes = context.contentResolver.openInputStream(page.imageUri)?.use { it.readBytes() }
            if (bytes != null) images.put(uprightBase64(bytes))
        }
        call.resolve(JSObject().apply { put("images", images) })
    }

    /**
     * Bakes EXIF orientation into the pixels and re-encodes with no orientation
     * tag, so the downstream canvas resize can't double-apply or ignore it (the
     * cause of the vertically-flipped capture).
     */
    private fun uprightBase64(bytes: ByteArray): String {
        return try {
            val orientation = ExifInterface(ByteArrayInputStream(bytes))
                .getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)
            var bmp = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
                ?: return Base64.encodeToString(bytes, Base64.NO_WRAP)
            val m = Matrix()
            when (orientation) {
                ExifInterface.ORIENTATION_ROTATE_90 -> m.postRotate(90f)
                ExifInterface.ORIENTATION_ROTATE_180 -> m.postRotate(180f)
                ExifInterface.ORIENTATION_ROTATE_270 -> m.postRotate(270f)
                ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> m.postScale(-1f, 1f)
                ExifInterface.ORIENTATION_FLIP_VERTICAL -> m.postScale(1f, -1f)
                ExifInterface.ORIENTATION_TRANSPOSE -> { m.postRotate(90f); m.postScale(-1f, 1f) }
                ExifInterface.ORIENTATION_TRANSVERSE -> { m.postRotate(270f); m.postScale(-1f, 1f) }
            }
            if (!m.isIdentity) {
                bmp = Bitmap.createBitmap(bmp, 0, 0, bmp.width, bmp.height, m, true)
            }
            val out = ByteArrayOutputStream()
            bmp.compress(Bitmap.CompressFormat.JPEG, 92, out)
            Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
        } catch (e: Exception) {
            Base64.encodeToString(bytes, Base64.NO_WRAP)
        }
    }

    private fun baseOptions(pageLimit: Int): GmsDocumentScannerOptions =
        GmsDocumentScannerOptions.Builder()
            .setGalleryImportAllowed(true)
            .setPageLimit(pageLimit)
            .setResultFormats(GmsDocumentScannerOptions.RESULT_FORMAT_JPEG)
            .setScannerMode(GmsDocumentScannerOptions.SCANNER_MODE_FULL)
            .build()
}
