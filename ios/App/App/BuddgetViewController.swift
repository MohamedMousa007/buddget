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
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(contentSizeCategoryChanged),
            name: UIContentSizeCategory.didChangeNotification,
            object: nil
        )
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    /// Pinch-zoom is off, so Dynamic Type is the only way to enlarge text. WKWebView ignores it for CSS
    /// by default; this makes the root font size follow it (16px at the default size, capped at 1.5x so
    /// layouts survive). All text is rem-based, so the whole UI scales with it.
    private var dynamicTypeRootPx: CGFloat {
        min(UIFontMetrics(forTextStyle: .body).scaledValue(for: 16), 16 * 1.5)
    }

    @objc private func contentSizeCategoryChanged() {
        webView?.evaluateJavaScript("document.documentElement.style.fontSize='\(dynamicTypeRootPx)px'")
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
        let rootSize = WKUserScript(
            source: "document.documentElement.style.fontSize='\(dynamicTypeRootPx)px';",
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        )
        wv.configuration.userContentController.addUserScript(rootSize)
        let css = "* { touch-action: pan-x pan-y; } input, textarea, select { font-size: max(16px, 1em) !important; }"
        let script = WKUserScript(
            source: "var s=document.createElement('style');s.textContent=\(css.debugDescription);document.head.appendChild(s);",
            injectionTime: .atDocumentEnd,
            forMainFrameOnly: true
        )
        wv.configuration.userContentController.addUserScript(script)
    }
}
