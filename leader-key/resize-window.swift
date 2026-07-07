import AppKit
import ApplicationServices
import CoreGraphics
import Foundation

// MARK: - Coordinate conversion
//
// NSScreen: origin at bottom-left of the primary display, y increases upward.
// AX API:   origin at top-left  of the primary display, y increases downward.

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

// Bundle ID of the launcher overlay that triggers this script.
// While its overlay is visible, Leader Key holds kAXFocusedApplicationAttribute
// and exposes its own window — we must skip it and wait for the real app.
private let launcherBundleIDs: Set<String> = ["com.brnbw.Leader-Key"]

private func frontmostWindow() -> AXUIElement? {
    // NSWorkspace.frontmostApplication is reliable even when the system-wide
    // AX focused-application attribute cannot complete (kAXErrorCannotComplete).
    // Poll up to 2 s so launcher overlays (e.g. Leader Key) have time to
    // dismiss and return focus to the previous application.
    for _ in 0 ..< 40 {
        guard let app = NSWorkspace.shared.frontmostApplication else {
            Thread.sleep(forTimeInterval: 0.05)
            continue
        }

        // Skip the launcher itself while its overlay is visible.
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

private func setWindowFrame(_ window: AXUIElement, _ frame: CGRect) {
    var pid: pid_t = 0
    AXUIElementGetPid(window, &pid)
    let appElement = AXUIElementCreateApplication(pid)

    // Firefox-based apps (e.g. Zen) use "AXEnhancedUserInterface" to intercept
    // AX resize events and re-anchor the window to the screen edge. Disabling
    // it lets a single size → position pass land the window atomically.
    var euiRef: CFTypeRef?
    let euiEnabled = AXUIElementCopyAttributeValue(
        appElement, "AXEnhancedUserInterface" as CFString, &euiRef
    ) == .success && euiRef.map { CFBooleanGetValue($0 as! CFBoolean) } == true

    if euiEnabled {
        AXUIElementSetAttributeValue(appElement, "AXEnhancedUserInterface" as CFString, kCFBooleanFalse)
    }
    defer {
        if euiEnabled {
            AXUIElementSetAttributeValue(appElement, "AXEnhancedUserInterface" as CFString, kCFBooleanTrue)
        }
    }

    // Position MUST be set before size: setting size first while the window is
    // far from the target position causes macOS to clip the size to keep the
    // window on screen (e.g. x=300 + w=1462 > 1512 → clipped to w=1212).
    var pos  = frame.origin
    var size = frame.size
    if let v = AXValueCreate(.cgPoint, &pos) {
        AXUIElementSetAttributeValue(window, kAXPositionAttribute as CFString, v)
    }
    if let v = AXValueCreate(.cgSize, &size) {
        AXUIElementSetAttributeValue(window, kAXSizeAttribute as CFString, v)
    }
}

// MARK: - Screen detection

private func screenForWindow(_ frame: CGRect) -> NSScreen {
    // Convert AX midpoint to NSScreen coordinates to find the containing screen.
    let mid = NSPoint(x: frame.midX, y: primaryScreenHeight - frame.midY)
    return NSScreen.screens.first(where: { NSPointInRect(mid, $0.frame) }) ?? NSScreen.main!
}

// MARK: - Presets

private let maximizeGap: CGFloat = 25

private func targetFrame(
    preset: String,
    axScreen s: CGRect,
    currentSize: CGSize
) -> CGRect? {
    switch preset {
    case "left":
        return CGRect(x: s.minX,  y: s.minY,  width: s.width / 2, height: s.height)
    case "right":
        return CGRect(x: s.midX,  y: s.minY,  width: s.width / 2, height: s.height)
    case "top":
        return CGRect(x: s.minX,  y: s.minY,  width: s.width,     height: s.height / 2)
    case "bottom":
        return CGRect(x: s.minX,  y: s.midY,  width: s.width,     height: s.height / 2)
    case "top-left":
        return CGRect(x: s.minX,  y: s.minY,  width: s.width / 2, height: s.height / 2)
    case "top-right":
        return CGRect(x: s.midX,  y: s.minY,  width: s.width / 2, height: s.height / 2)
    case "bottom-left":
        return CGRect(x: s.minX,  y: s.midY,  width: s.width / 2, height: s.height / 2)
    case "bottom-right":
        return CGRect(x: s.midX,  y: s.midY,  width: s.width / 2, height: s.height / 2)
    case "center":
        return CGRect(
            x: s.midX - currentSize.width  / 2,
            y: s.midY - currentSize.height / 2,
            width:  currentSize.width,
            height: currentSize.height
        )
    case "maximize":
        return s.insetBy(dx: maximizeGap, dy: maximizeGap)
    case "full":
        return s
    default:
        return nil
    }
}

// MARK: - Argument parsing

private func parseFloat(_ s: String) -> CGFloat? {
    Double(s).map { CGFloat($0) }
}

// MARK: - Main

let args = Array(CommandLine.arguments.dropFirst())

guard !args.isEmpty else {
    fputs("""
    Usage:
      resize-window <preset>
      resize-window <width> <height>
      resize-window <width> <height> <x> <y>

    Presets: left, right, top, bottom,
             top-left, top-right, bottom-left, bottom-right,
             center, maximize, full
    
    Notes:
      - Presets snap to the window's current screen (visible area).
      - 'center' keeps the window's current size.
      - 'maximize' fills the screen with a \(Int(maximizeGap))px gap on each side.
      - <width> <height> centers the window at that size on the current screen.
      - <width> <height> <x> <y> places it at exact AX global coordinates.

    """, stderr)
    exit(1)
}

guard let window = frontmostWindow() else {
    fputs("resize-window: could not get a focused window after 1s\n", stderr)
    exit(1)
}

guard let currentFrame = windowFrame(window) else {
    fputs("resize-window: could not read window geometry\n", stderr)
    exit(1)
}

let screen = screenForWindow(currentFrame)
let axScreen = nsRectToAX(screen.visibleFrame)
let newFrame: CGRect

switch args.count {
case 1:
    guard let frame = targetFrame(preset: args[0], axScreen: axScreen, currentSize: currentFrame.size) else {
        fputs("resize-window: unknown preset '\(args[0])'\n", stderr)
        exit(1)
    }
    newFrame = frame

case 2:
    guard let w = parseFloat(args[0]), let h = parseFloat(args[1]) else {
        fputs("resize-window: invalid dimensions '\(args[0])' '\(args[1])'\n", stderr)
        exit(1)
    }
    newFrame = CGRect(x: axScreen.midX - w / 2, y: axScreen.midY - h / 2, width: w, height: h)

case 4:
    guard
        let w = parseFloat(args[0]), let h = parseFloat(args[1]),
        let x = parseFloat(args[2]), let y = parseFloat(args[3])
    else {
        fputs("resize-window: invalid arguments\n", stderr)
        exit(1)
    }
    newFrame = CGRect(x: x, y: y, width: w, height: h)

default:
    fputs("resize-window: expected 1, 2, or 4 arguments\n", stderr)
    exit(1)
}

setWindowFrame(window, newFrame)
