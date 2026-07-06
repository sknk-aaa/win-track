import ExpoModulesCore
import StoreKit
import UIKit
import WidgetKit

private let appGroupIdentifier = "group.com.sknkaaa.wintrack"
private let snapshotFileName = "widget-snapshot.json"
private let snapshotDefaultsKey = "widget-snapshot"
private let eventsFileName = "widget-events.json"

public class WinTrackWidgetBridgeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("WinTrackWidgetBridge")

    AsyncFunction("saveWidgetSnapshot") { (payload: String) throws in
      guard let snapshotURL = sharedContainerURL()?.appendingPathComponent(snapshotFileName) else {
        throw sharedContainerError()
      }
      let defaults = UserDefaults(suiteName: appGroupIdentifier)
      defaults?.set(payload, forKey: snapshotDefaultsKey)
      defaults?.synchronize()
      try payload.write(to: snapshotURL, atomically: true, encoding: .utf8)
    }

    AsyncFunction("readWidgetEvents") { () throws -> String? in
      guard let eventsURL = sharedContainerURL()?.appendingPathComponent(eventsFileName) else {
        throw sharedContainerError()
      }
      guard FileManager.default.fileExists(atPath: eventsURL.path) else {
        return nil
      }
      return try String(contentsOf: eventsURL, encoding: .utf8)
    }

    AsyncFunction("clearWidgetEvents") { () throws in
      guard let eventsURL = sharedContainerURL()?.appendingPathComponent(eventsFileName) else {
        throw sharedContainerError()
      }
      try "[]".write(to: eventsURL, atomically: true, encoding: .utf8)
    }

    AsyncFunction("reloadAllTimelines") {
      if #available(iOS 14.0, *) {
        WidgetCenter.shared.reloadAllTimelines()
      }
    }

    AsyncFunction("requestReview") {
      DispatchQueue.main.async {
        guard let scene = UIApplication.shared.connectedScenes
          .compactMap({ $0 as? UIWindowScene })
          .first(where: { $0.activationState == .foregroundActive }) else {
          return
        }
        SKStoreReviewController.requestReview(in: scene)
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

  private func sharedContainerURL() -> URL? {
    FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupIdentifier)
  }

  private func sharedContainerError() -> NSError {
    NSError(
      domain: "WinTrackWidgetBridge",
      code: 1,
      userInfo: [NSLocalizedDescriptionKey: "App Group shared container is unavailable."]
    )
  }
}
