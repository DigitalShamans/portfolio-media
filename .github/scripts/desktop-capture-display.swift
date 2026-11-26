#!/usr/bin/env swift

// Keep a real macOS display large enough for native Safari captures while the
// supplied command runs. This changes an advertised display mode, never browser
// metrics, page scale, or screenshot pixels.
//
// Usage:
//   swift desktop-capture-display.swift -- python3 desktop-typography-safari.py
//
// CGDisplaySetDisplayMode's setting lasts only while this process is alive:
// https://developer.apple.com/documentation/coregraphics/cgdisplaysetdisplaymode(_:_:_:)
// Available modes come from the public CoreGraphics API:
// https://developer.apple.com/documentation/coregraphics/cgdisplaycopyalldisplaymodes(_:_:)

import CoreGraphics
import Darwin
import Foundation

let minimumWidth = 3840
let minimumHeight = 2160
let preferredHeight = 2300

func log(_ event: String, _ fields: [String: Any]) {
    var record = fields
    record["event"] = event
    guard let data = try? JSONSerialization.data(withJSONObject: record, options: [.sortedKeys]),
          let text = String(data: data, encoding: .utf8) else {
        fputs("Could not encode display diagnostics.\n", stderr)
        exit(2)
    }
    print(text)
    fflush(stdout)
}

func fail(_ message: String, _ fields: [String: Any] = [:]) -> Never {
    var details = fields
    details["message"] = message
    log("display_setup_failed", details)
    exit(2)
}

func describe(_ mode: CGDisplayMode) -> [String: Any] {
    return [
        "width": mode.width,
        "height": mode.height,
        "pixelWidth": mode.pixelWidth,
        "pixelHeight": mode.pixelHeight,
        "refreshRate": mode.refreshRate
    ]
}

func describeBounds(_ display: CGDirectDisplayID) -> [String: Any] {
    let bounds = CGDisplayBounds(display)
    return [
        "x": Double(bounds.origin.x),
        "y": Double(bounds.origin.y),
        "width": Double(bounds.width),
        "height": Double(bounds.height)
    ]
}

let arguments = Array(CommandLine.arguments.dropFirst())
guard arguments.first == "--", arguments.count > 1 else {
    fail("Pass a capture command after --. The helper must stay alive during capture because its display mode reverts when it exits.")
}

let display = CGMainDisplayID()
guard display != kCGNullDirectDisplay else {
    fail("No main display is available to native Safari.")
}
guard let modes = CGDisplayCopyAllDisplayModes(display, nil) as? [CGDisplayMode], !modes.isEmpty else {
    fail("CoreGraphics returned no supported modes for the main display.", ["displayID": display])
}

var initial: [String: Any] = [
    "displayID": display,
    "bounds": describeBounds(display),
    "minimumWidth": minimumWidth,
    "minimumHeight": minimumHeight,
    "preferredHeight": preferredHeight,
    "availableModes": modes.map { describe($0) }
]
if let mode = CGDisplayCopyDisplayMode(display) {
    initial["currentMode"] = describe(mode)
}
log("display_modes", initial)

// Mode width/height, rather than backing pixelWidth/pixelHeight, govern the
// desktop coordinate space. A Retina 3840-pixel mode with width 1920 is too small.
// Prefer room for the 2160px page plus Safari chrome, menu bar and Dock. If no
// taller mode exists, allow an actual 3840x2160 desktop and verify its captures.
let candidates = modes.filter {
    $0.width >= minimumWidth && $0.height >= minimumHeight
}.sorted { first, second in
    let firstHasHeadroom = first.height >= preferredHeight
    let secondHasHeadroom = second.height >= preferredHeight
    if firstHasHeadroom != secondHasHeadroom {
        return firstHasHeadroom
    }
    let firstArea = Int64(first.width) * Int64(first.height)
    let secondArea = Int64(second.width) * Int64(second.height)
    if firstArea != secondArea {
        return firstArea < secondArea
    }
    let firstPixelArea = Int64(first.pixelWidth) * Int64(first.pixelHeight)
    let secondPixelArea = Int64(second.pixelWidth) * Int64(second.pixelHeight)
    if firstPixelArea != secondPixelArea {
        return firstPixelArea < secondPixelArea
    }
    return first.refreshRate > second.refreshRate
}

guard let selected = candidates.first else {
    fail("No supported main-display mode provides at least 3840x2160 desktop coordinates. Native 4K captures require a larger available display mode.", ["displayID": display])
}
log("display_mode_selected", ["displayID": display, "mode": describe(selected)])
let result = CGDisplaySetDisplayMode(display, selected, nil)
guard result == .success else {
    fail("CoreGraphics could not set the selected display mode.", ["displayID": display, "cgError": result.rawValue])
}

// The public API switches synchronously. Check the real coordinate space after
// the operation instead of assuming the requested mode was applied.
let bounds = CGDisplayBounds(display)
guard bounds.width >= CGFloat(minimumWidth), bounds.height >= CGFloat(minimumHeight) else {
    fail("The applied display bounds are smaller than the required capture size.", ["displayID": display, "bounds": describeBounds(display)])
}
var ready: [String: Any] = ["displayID": display, "bounds": describeBounds(display)]
if let mode = CGDisplayCopyDisplayMode(display) {
    ready["currentMode"] = describe(mode)
}
log("display_ready", ready)

let capture = Process()
capture.executableURL = URL(fileURLWithPath: "/usr/bin/env")
capture.arguments = Array(arguments.dropFirst())
do {
    try capture.run()
} catch {
    fail("Could not launch the capture command.", ["error": String(describing: error)])
}
capture.waitUntilExit()
let code = capture.terminationReason == .uncaughtSignal
    ? 128 + capture.terminationStatus
    : capture.terminationStatus
log("capture_command_finished", ["exitStatus": code, "displayModeLifetime": "Ends when this helper exits."])
exit(code)
