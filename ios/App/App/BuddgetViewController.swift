import UIKit
import WebKit
import Capacitor

/// Registers in-app-target Capacitor plugins. `packageClassList` in
/// capacitor.config.json is regenerated from node_modules on every
/// `cap sync`, so local plugins must register here instead.
class BuddgetViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(SmsCapacitorPlugin())
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        disableWebViewZoomAndBounce()
    }

    private func disableWebViewZoomAndBounce() {
        guard let wv = webView else { return }
        // Kill pinch-zoom at the scroll-view level — belt-and-suspenders over
        // the viewport maximum-scale=1 meta, which WKWebView sometimes ignores
        // on input focus.
        wv.scrollView.pinchGestureRecognizer?.isEnabled = false
        wv.scrollView.minimumZoomScale = 1.0
        wv.scrollView.maximumZoomScale = 1.0
        // Prevent rubber-band bounce at top/bottom.
        wv.scrollView.bounces = false
        wv.scrollView.alwaysBounceVertical = false
        wv.scrollView.alwaysBounceHorizontal = false
        // Inject CSS as a fallback: stops iOS from auto-zooming inputs.
        let css = "* { touch-action: pan-x pan-y; } input, textarea, select { font-size: max(16px, 1em) !important; }"
        let script = WKUserScript(
            source: "var s=document.createElement('style');s.textContent=\(css.debugDescription);document.head.appendChild(s);",
            injectionTime: .atDocumentEnd,
            forMainFrameOnly: true
        )
        wv.configuration.userContentController.addUserScript(script)
    }
}
