package app.buddget

import android.Manifest
import android.content.pm.PackageManager
import android.webkit.PermissionRequest
import com.getcapacitor.BridgeActivity
import com.getcapacitor.BridgeWebChromeClient
import ee.forgr.capacitor.social.login.SocialLoginPlugin

class MainActivity : BridgeActivity() {
    private var pendingMicRequest: PermissionRequest? = null

    override fun onCreate(savedInstanceState: android.os.Bundle?) {
        registerPlugin(SmsCapacitorPlugin::class.java)
        registerPlugin(SocialLoginPlugin::class.java)
        super.onCreate(savedInstanceState)
        // Android WebView denies getUserMedia unless the host app grants the
        // RESOURCE_AUDIO_CAPTURE resource here — even when RECORD_AUDIO is held.
        // Capacitor's default WebChromeClient does not do this, so we override it.
        bridge.webView.webChromeClient = object : BridgeWebChromeClient(bridge) {
            override fun onPermissionRequest(request: PermissionRequest) {
                if (request.resources.contains(PermissionRequest.RESOURCE_AUDIO_CAPTURE)) {
                    runOnUiThread {
                        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) ==
                            PackageManager.PERMISSION_GRANTED
                        ) {
                            request.grant(arrayOf(PermissionRequest.RESOURCE_AUDIO_CAPTURE))
                        } else {
                            // First run: OS permission not answered yet — request it,
                            // then grant/deny the WebView in onRequestPermissionsResult.
                            pendingMicRequest = request
                            requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), MIC_PERMISSION_CODE)
                        }
                    }
                } else {
                    request.deny()
                }
            }
        }
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray,
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == MIC_PERMISSION_CODE) {
            val req = pendingMicRequest
            pendingMicRequest = null
            if (req != null) {
                if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                    req.grant(arrayOf(PermissionRequest.RESOURCE_AUDIO_CAPTURE))
                } else {
                    req.deny()
                }
            }
        }
    }

    private companion object {
        const val MIC_PERMISSION_CODE = 0xA00D
    }
}
