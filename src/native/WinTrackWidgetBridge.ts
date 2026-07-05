import { requireNativeModule } from 'expo-modules-core';

type WinTrackWidgetBridgeModule = {
  reloadAllTimelines: () => Promise<void>;
};

const nativeModule = requireNativeModule<WinTrackWidgetBridgeModule>('WinTrackWidgetBridge');

export async function reloadAllWidgetTimelines() {
  await nativeModule.reloadAllTimelines();
}
