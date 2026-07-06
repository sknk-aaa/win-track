import ExpoModulesCore
import UIKit
import WidgetKit

public class WinTrackWidgetBridgeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("WinTrackWidgetBridge")

    AsyncFunction("reloadAllTimelines") {
      if #available(iOS 14.0, *) {
        WidgetCenter.shared.reloadAllTimelines()
      }
    }

    AsyncFunction("getAlternateIconName") { () async -> String? in
      await MainActor.run {
        UIApplication.shared.alternateIconName
      }
    }

    AsyncFunction("setAlternateIconName") { (iconName: String?) async throws -> String? in
      try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<String?, Error>) in
        DispatchQueue.main.async {
          guard UIApplication.shared.supportsAlternateIcons else {
            continuation.resume(
              throwing: NSError(
                domain: "WinTrackAppIcon",
                code: 1,
                userInfo: [NSLocalizedDescriptionKey: "Alternate app icons are not supported."]
              )
            )
            return
          }

          UIApplication.shared.setAlternateIconName(iconName) { error in
            if let error {
              continuation.resume(throwing: error)
              return
            }
            continuation.resume(returning: UIApplication.shared.alternateIconName)
          }
        }
      }
    }
  }
}
