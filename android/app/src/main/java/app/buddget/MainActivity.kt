package app.buddget

import android.content.pm.PackageManager
import android.webkit.PermissionRequest
import com.getcapacitor.BridgeActivity
import com.getcapacitor.BridgeWebChromeClient

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: android.os.Bundle?) {
        registerPlugin(SmsCapacitorPlugin::class.java)
        super.onCreate(savedInstanceState)
        // Grant audio capture to the WebView when the OS permission is already held.
        // Without this override the WebChromeClient silently denies getUserMedia on Android.
        bridge.webView.webChromeClient = object : BridgeWebChromeClient(bridge) {
            override fun onPermissionRequest(request: PermissionRequest) {
                val granted = request.resources.filter { resource ->
                    resource != PermissionRequest.RESOURCE_AUDIO_CAPTURE ||
                        checkSelfPermission(android.Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
                }.toTypedArray()
                if (granted.isNotEmpty()) request.grant(granted) else request.deny()
            }
        }
    }
}
