import ExpoModulesCore
import WidgetKit

public class WinTrackWidgetBridgeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("WinTrackWidgetBridge")

    AsyncFunction("reloadAllTimelines") {
      if #available(iOS 14.0, *) {
        WidgetCenter.shared.reloadAllTimelines()
      }
    }
  }
}
