import Foundation
import Capacitor
import VisionKit
import UIKit

/// Native receipt scanner backed by VisionKit's `VNDocumentCameraViewController`
/// (auto edge-detect, perspective correction, manual crop, multi-page). Returns
/// base64 JPEGs — one per page — to match the Android ML Kit plugin's contract.
@objc(DocumentScannerPlugin)
public class DocumentScannerPlugin: CAPInstancePlugin, CAPBridgedPlugin {
    public let identifier = "DocumentScannerPlugin"
    public let jsName = "DocumentScanner"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "scan", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise)
    ]

    private var pendingCall: CAPPluginCall?

    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve(["available": VNDocumentCameraViewController.isSupported])
    }

    @objc func scan(_ call: CAPPluginCall) {
        // VisionKit has no gallery picker — let JS fall back to the photo library.
        if call.getString("source") == "gallery" {
            call.reject("unsupported")
            return
        }
        guard VNDocumentCameraViewController.isSupported else {
            call.reject("unsupported")
            return
        }

        pendingCall = call
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            let scanner = VNDocumentCameraViewController()
            scanner.delegate = self
            self.bridge?.viewController?.present(scanner, animated: true)
        }
    }

    private func finish(_ call: CAPPluginCall, images: [String]) {
        call.resolve(["images": images])
    }
}

extension DocumentScannerPlugin: VNDocumentCameraViewControllerDelegate {
    public func documentCameraViewController(
        _ controller: VNDocumentCameraViewController,
        didFinishWith scan: VNDocumentCameraScan
    ) {
        var images: [String] = []
        for i in 0..<scan.pageCount {
            let page = scan.imageOfPage(at: i)
            if let jpeg = page.jpegData(compressionQuality: 0.8) {
                images.append(jpeg.base64EncodedString())
            }
        }
        controller.dismiss(animated: true) { [weak self] in
            guard let self = self, let call = self.pendingCall else { return }
            self.pendingCall = nil
            self.finish(call, images: images)
        }
    }

    public func documentCameraViewControllerDidCancel(_ controller: VNDocumentCameraViewController) {
        controller.dismiss(animated: true) { [weak self] in
            guard let self = self, let call = self.pendingCall else { return }
            self.pendingCall = nil
            call.reject("cancelled")
        }
    }

    public func documentCameraViewController(
        _ controller: VNDocumentCameraViewController,
        didFailWithError error: Error
    ) {
        controller.dismiss(animated: true) { [weak self] in
            guard let self = self, let call = self.pendingCall else { return }
            self.pendingCall = nil
            call.reject(error.localizedDescription)
        }
    }
}
