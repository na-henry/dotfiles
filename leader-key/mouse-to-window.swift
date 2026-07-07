import AppKit
import ApplicationServices
import CoreGraphics
import Foundation

// If an app path was passed, open it first.
if CommandLine.arguments.count > 1 {
    let appURL = URL(fileURLWithPath: CommandLine.arguments[1])
    NSWorkspace.shared.open(appURL)
}

// Poll until the frontmost app has a focused window (up to ~1 second).
// This is needed because open() returns before the window is actually focused.
func focusedWindow() -> AXUIElement? {
    for _ in 0 ..< 20 {
        if let app = NSRunningApplication.runningApplications(
            withBundleIdentifier:
                NSWorkspace.shared.frontmostApplication?.bundleIdentifier ?? ""
        ).first {
            let appElement = AXUIElementCreateApplication(app.processIdentifier)
            var ref: CFTypeRef?
            if AXUIElementCopyAttributeValue(
                appElement, kAXFocusedWindowAttribute as CFString, &ref
            ) == .success, let ref {
                return (ref as! AXUIElement)
            }
        }
        Thread.sleep(forTimeInterval: 0.05)
    }
    return nil
}

guard let window = focusedWindow() else {
    fputs("mouse-to-window: could not get a focused window after 1s\n", stderr)
    exit(1)
}

var posRef: CFTypeRef?
var sizeRef: CFTypeRef?
AXUIElementCopyAttributeValue(window, kAXPositionAttribute as CFString, &posRef)
AXUIElementCopyAttributeValue(window, kAXSizeAttribute as CFString, &sizeRef)

guard let posRef, let sizeRef else {
    fputs("mouse-to-window: could not read window geometry\n", stderr)
    exit(1)
}

var pos = CGPoint.zero
var size = CGSize.zero
AXValueGetValue(posRef as! AXValue, .cgPoint, &pos)
AXValueGetValue(sizeRef as! AXValue, .cgSize, &size)

let target = CGPoint(
    x: pos.x + size.width / 2,
    y: pos.y + size.height / 2
)

let result = CGWarpMouseCursorPosition(target)
if result != .success {
    fputs("mouse-to-window: CGWarpMouseCursorPosition failed (CGError \(result.rawValue))\n", stderr)
    exit(1)
}
