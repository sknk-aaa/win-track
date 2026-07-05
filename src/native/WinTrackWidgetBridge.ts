import { requireOptionalNativeModule } from 'expo-modules-core';

type WinTrackWidgetBridgeModule = {
  reloadAllTimelines: () => Promise<void>;
};

let nativeModule: WinTrackWidgetBridgeModule | null | undefined;

function getNativeModule() {
  if (nativeModule !== undefined) {
    return nativeModule;
  }
  nativeModule = requireOptionalNativeModule<WinTrackWidgetBridgeModule>('WinTrackWidgetBridge');
  return nativeModule;
}

export async function reloadAllWidgetTimelines() {
  await getNativeModule()?.reloadAllTimelines();
}
