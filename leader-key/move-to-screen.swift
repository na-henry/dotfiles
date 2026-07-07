import AppKit
import ApplicationServices
import CoreGraphics
import Foundation

// MARK: - Coordinate conversion

private var primaryScreenHeight: CGFloat {
    NSScreen.screens.first(where: { $0.frame.origin == .zero })?.frame.height ?? 0
}

private func nsRectToAX(_ rect: NSRect) -> CGRect {
    CGRect(
        x: rect.origin.x,
        y: primaryScreenHeight - rect.origin.y - rect.height,
        width: rect.width,
        height: rect.height
    )
}

// MARK: - Window helpers

private let launcherBundleIDs: Set<String> = ["com.brnbw.Leader-Key"]

private func frontmostWindow() -> AXUIElement? {
    for _ in 0 ..< 40 {
        guard let app = NSWorkspace.shared.frontmostApplication else {
            Thread.sleep(forTimeInterval: 0.05)
            continue
        }
        if launcherBundleIDs.contains(app.bundleIdentifier ?? "") {
            Thread.sleep(forTimeInterval: 0.05)
            continue
        }
        let appElement = AXUIElementCreateApplication(app.processIdentifier)
        var windowRef: CFTypeRef?
        if AXUIElementCopyAttributeValue(
            appElement, kAXFocusedWindowAttribute as CFString, &windowRef
        ) == .success, let windowRef {
            return windowRef as! AXUIElement
        }
        Thread.sleep(forTimeInterval: 0.05)
    }
    return nil
}

private func windowFrame(_ window: AXUIElement) -> CGRect? {
    var posRef: CFTypeRef?
    var sizeRef: CFTypeRef?
    guard
        AXUIElementCopyAttributeValue(window, kAXPositionAttribute as CFString, &posRef) == .success,
        AXUIElementCopyAttributeValue(window, kAXSizeAttribute as CFString, &sizeRef) == .success,
        let posRef, let sizeRef
    else { return nil }
    var pos = CGPoint.zero
    var size = CGSize.zero
    AXValueGetValue(posRef as! AXValue, .cgPoint, &pos)
    AXValueGetValue(sizeRef as! AXValue, .cgSize, &size)
    return CGRect(origin: pos, size: size)
}

private func screenForWindow(_ frame: CGRect) -> NSScreen {
    let mid = NSPoint(x: frame.midX, y: primaryScreenHeight - frame.midY)
    return NSScreen.screens.first(where: { NSPointInRect(mid, $0.frame) }) ?? NSScreen.main!
}

// MARK: - Main

guard let window = frontmostWindow() else {
    fputs("move-to-screen: could not get a focused window after 2s\n", stderr)
    exit(1)
}
guard let currentFrame = windowFrame(window) else {
    fputs("move-to-screen: could not read window geometry\n", stderr)
    exit(1)
}

let screens = NSScreen.screens
guard screens.count > 1 else {
    fputs("move-to-screen: only one screen detected\n", stderr)
    exit(0)
}

let currentScreen = screenForWindow(currentFrame)
let currentIndex  = screens.firstIndex(of: currentScreen) ?? 0
let nextScreen    = screens[(currentIndex + 1) % screens.count]
let toAX          = nsRectToAX(nextScreen.visibleFrame)

// Teleport the window to the centre of the destination screen so that
// resize-window's screenForWindow() will detect the correct screen.
var pos = CGPoint(x: toAX.midX - currentFrame.width / 2,
                  y: toAX.midY - currentFrame.height / 2)
if let v = AXValueCreate(.cgPoint, &pos) {
    AXUIElementSetAttributeValue(window, kAXPositionAttribute as CFString, v)
}


