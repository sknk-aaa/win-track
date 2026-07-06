import { requireOptionalNativeModule } from 'expo-modules-core';

export type AlternateAppIconName = 'AppIcon2' | 'AppIcon3' | 'AppIcon4';

type WinTrackWidgetBridgeModule = {
  reloadAllTimelines: () => Promise<void>;
  saveWidgetSnapshot?: (payload: string) => Promise<void>;
  readWidgetEvents?: () => Promise<string | null>;
  clearWidgetEvents?: () => Promise<void>;
  requestReview?: () => Promise<void>;
  getAlternateIconName?: () => Promise<AlternateAppIconName | null>;
  setAlternateIconName?: (iconName: AlternateAppIconName | null) => Promise<AlternateAppIconName | null>;
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

export async function saveWidgetSnapshotPayload(payload: string) {
  const nativeModule = getNativeModule();
  if (!nativeModule?.saveWidgetSnapshot) {
    throw new Error('Widget native module is unavailable.');
  }
  await nativeModule.saveWidgetSnapshot(payload);
}

export async function readWidgetEventsPayload() {
  const nativeModule = getNativeModule();
  if (!nativeModule?.readWidgetEvents) {
    throw new Error('Widget native module is unavailable.');
  }
  return await nativeModule.readWidgetEvents();
}

export async function clearWidgetEventsPayload() {
  const nativeModule = getNativeModule();
  if (!nativeModule?.clearWidgetEvents) {
    throw new Error('Widget native module is unavailable.');
  }
  await nativeModule.clearWidgetEvents();
}

export async function requestAppReview() {
  await getNativeModule()?.requestReview?.();
}

export async function getAlternateAppIconName() {
  return (await getNativeModule()?.getAlternateIconName?.()) ?? null;
}

export async function setAlternateAppIconName(iconName: AlternateAppIconName | null) {
  const nativeModule = getNativeModule();
  if (!nativeModule?.setAlternateIconName) {
    throw new Error('Alternate app icon native module is unavailable.');
  }
  return (await nativeModule.setAlternateIconName(iconName)) ?? null;
}
