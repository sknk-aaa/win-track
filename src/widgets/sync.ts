import { requireOptionalNativeModule } from 'expo-modules-core';

import {
  clearWidgetEventsPayload,
  reloadAllWidgetTimelines,
  readWidgetEventsPayload,
  saveWidgetSnapshotPayload
} from '../native/WinTrackWidgetBridge';
import { formatWinRate } from '../lib/format';
import {
  listCounters,
  listWidgetSlots,
  recordWidgetEvent
} from '../data/store';
import type {
  CounterSummary,
  WidgetCounterSnapshot,
  WidgetPendingEvent,
  WidgetSlot,
  WidgetSlotId,
  WinRateWidgetProps
} from '../types';

export type WidgetSyncResult = {
  ok: boolean;
  message: string | null;
};

const appGroupIdentifier = 'group.com.sknkaaa.wintrack';
const snapshotDefaultsKey = 'widget-snapshot';
const widgetKind = 'WinRateWidget';

type ExtensionStorageModule = {
  setString?: (key: string, value: string, group: string | null) => void;
  get?: (key: string, group: string | null) => string | null;
  reloadWidget?: (timeline: string | null) => void;
};

let extensionStorageModule: ExtensionStorageModule | null | undefined;

const slotLabels: Record<WidgetSlotId, string> = {
  'slot1': '枠1',
  'slot2': '枠2',
  'slot3': '枠3'
};

export async function reconcileWidgetEvents() {
  const pendingEvents = await readPendingWidgetEvents();
  for (const event of pendingEvents) {
    await recordWidgetEvent(event.id, event.counterId, event.result, event.createdAt);
  }
  let didClearEvents = true;
  if (pendingEvents.length > 0) {
    try {
      await clearWidgetEventsPayload();
    } catch (error) {
      didClearEvents = false;
      console.warn('Failed to clear widget events', error);
    }
  }
  const publishResult = await publishWidgetSnapshot([]);
  return {
    ok: didClearEvents && publishResult.ok,
    message: didClearEvents ? publishResult.message : joinMessages('Failed to clear widget events.', publishResult.message)
  };
}

export async function publishWidgetSnapshot(pendingEvents: WidgetPendingEvent[] = []) {
  const [counters, slots] = await Promise.all([listCounters(), listWidgetSlots()]);
  const snapshot: WinRateWidgetProps = {
    slots: slots.map((slot) => toSnapshot(slot, counters, pendingEvents)),
    updatedAt: new Date().toISOString()
  };
  const payload = JSON.stringify(snapshot);
  let saveMessage: string | null = null;
  try {
    await saveWidgetSnapshotPayload(payload);
  } catch (error) {
    const nativeMessage = `Native bridge: ${getErrorMessage(error)}`;
    console.warn('Failed to save widget snapshot to shared container', error);
    const fallbackResult = saveSnapshotWithExtensionStorage(payload);
    if (!fallbackResult.ok) {
      saveMessage = joinMessages(nativeMessage, fallbackResult.message);
    }
  }
  try {
    await reloadAllWidgetTimelines();
  } catch (error) {
    console.warn('Failed to reload widget timelines', error);
    try {
      getExtensionStorageModule()?.reloadWidget?.(widgetKind);
    } catch (fallbackError) {
      console.warn('Failed to reload widget timelines with ExtensionStorage', fallbackError);
    }
  }
  return {
    ok: saveMessage === null,
    message: saveMessage
  };
}

function saveSnapshotWithExtensionStorage(payload: string): WidgetSyncResult {
  try {
    const storage = getExtensionStorageModule();
    if (!storage?.setString || !storage.get) {
      return {
        ok: false,
        message: 'ExtensionStorage native module is unavailable.'
      };
    }
    storage.setString(snapshotDefaultsKey, payload, appGroupIdentifier);
    const storedPayload = storage.get(snapshotDefaultsKey, appGroupIdentifier);
    if (storedPayload !== payload) {
      return {
        ok: false,
        message: `ExtensionStorage: saved value verification failed. stored=${storedPayload ?? 'null'}`
      };
    }
    storage.reloadWidget?.(widgetKind);
    return { ok: true, message: null };
  } catch (error) {
    return {
      ok: false,
      message: `ExtensionStorage: ${getErrorMessage(error)}`
    };
  }
}

function getExtensionStorageModule() {
  if (extensionStorageModule !== undefined) {
    return extensionStorageModule;
  }
  extensionStorageModule = requireOptionalNativeModule<ExtensionStorageModule>('ExtensionStorage');
  return extensionStorageModule;
}

async function readPendingWidgetEvents() {
  try {
    const raw = await readWidgetEventsPayload();
    const events = raw ? (JSON.parse(raw) as WidgetPendingEvent[]) : [];
    return dedupeEvents(events ?? []);
  } catch (error) {
    console.warn('Failed to read widget events', error);
    return [];
  }
}

function toSnapshot(
  slot: WidgetSlot,
  counters: CounterSummary[],
  pendingEvents: WidgetPendingEvent[]
): WidgetCounterSnapshot {
  const counter = slot.counterId
    ? counters.find((candidate) => candidate.id === slot.counterId)
    : undefined;

  if (!counter) {
    return {
      slotId: slot.id,
      label: slotLabels[slot.id],
      counterId: null,
      name: 'カウンターなし',
      wins: 0,
      losses: 0,
      total: 0,
      winRateLabel: '--%',
      isAvailable: false,
      pendingEvents: []
    };
  }

  const slotPending = pendingEvents.filter((event) => event.slotId === slot.id);
  const wins = counter.wins + slotPending.filter((event) => event.result === 'win').length;
  const losses = counter.losses + slotPending.filter((event) => event.result === 'loss').length;

  return {
    slotId: slot.id,
    label: slotLabels[slot.id],
    counterId: counter.id,
    name: counter.name,
    wins,
    losses,
    total: wins + losses,
    winRateLabel: formatWinRate(wins, losses),
    isAvailable: true,
    pendingEvents: slotPending
  };
}

function dedupeEvents(events: WidgetPendingEvent[]) {
  const deduped = new Map<string, WidgetPendingEvent>();
  for (const event of events) {
    if (isWidgetPendingEvent(event)) {
      deduped.set(event.id, event);
    }
  }
  return [...deduped.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function isWidgetPendingEvent(value: unknown): value is WidgetPendingEvent {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Partial<WidgetPendingEvent>;
  return (
    typeof candidate.id === 'string' &&
    (candidate.slotId === 'slot1' || candidate.slotId === 'slot2' || candidate.slotId === 'slot3') &&
    typeof candidate.counterId === 'string' &&
    (candidate.result === 'win' || candidate.result === 'loss') &&
    typeof candidate.createdAt === 'string'
  );
}

function joinMessages(...messages: (string | null)[]) {
  return messages.filter((message): message is string => Boolean(message)).join('\n');
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
