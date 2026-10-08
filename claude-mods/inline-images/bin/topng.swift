// Reads a base64 image (any format ImageIO decodes) on stdin and writes
// "<width> <height>\n<base64 PNG>" to stdout, scaled to at most 800 px on the
// longer side. No files: sips' temp-and-rename write is refused under the mod.
// Build: swiftc -O topng.swift -o topng
import Foundation
import ImageIO
import UniformTypeIdentifiers

func fail(_ message: String) -> Never {
  FileHandle.standardError.write(Data((message + "\n").utf8))
  exit(1)
}

let input = FileHandle.standardInput.readDataToEndOfFile()
guard let text = String(data: input, encoding: .utf8),
      let bytes = Data(base64Encoded: text.trimmingCharacters(in: .whitespacesAndNewlines),
                       options: .ignoreUnknownCharacters)
else { fail("stdin is not base64") }

guard let source = CGImageSourceCreateWithData(bytes as CFData, nil) else { fail("not an image") }
let options: [CFString: Any] = [
  kCGImageSourceCreateThumbnailFromImageAlways: true,
  kCGImageSourceCreateThumbnailWithTransform: true,
  kCGImageSourceThumbnailMaxPixelSize: 800,
]
guard let image = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary) else {
  fail("cannot decode")
}

let out = NSMutableData()
guard let dest = CGImageDestinationCreateWithData(out, UTType.png.identifier as CFString, 1, nil) else {
  fail("cannot encode")
}
CGImageDestinationAddImage(dest, image, nil)
guard CGImageDestinationFinalize(dest) else { fail("cannot encode") }

print("\(image.width) \(image.height)")
print((out as Data).base64EncodedString())
