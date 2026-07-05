import { Paths } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';

import { reloadAllWidgetTimelines } from '../native/WinTrackWidgetBridge';
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

const appGroupIdentifier = 'group.com.sknkaaa.wintrack';
const snapshotFileName = 'widget-snapshot.json';
const eventsFileName = 'widget-events.json';

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
  if (pendingEvents.length > 0) {
    await writeJson(eventsFileName, []);
  }
  await publishWidgetSnapshot([]);
}

export async function publishWidgetSnapshot(pendingEvents: WidgetPendingEvent[] = []) {
  const [counters, slots] = await Promise.all([listCounters(), listWidgetSlots()]);
  const snapshot: WinRateWidgetProps = {
    slots: slots.map((slot) => toSnapshot(slot, counters, pendingEvents)),
    updatedAt: new Date().toISOString()
  };
  try {
    await writeJson(snapshotFileName, snapshot);
    await reloadAllWidgetTimelines();
  } catch (error) {
    console.warn('Failed to update widget snapshot', error);
  }
}

async function readPendingWidgetEvents() {
  try {
    const events = await readJson<WidgetPendingEvent[]>(eventsFileName);
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

async function readJson<T>(fileName: string) {
  const uri = getSharedFileUri(fileName);
  if (!uri) {
    return null;
  }
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists) {
    return null;
  }
  const raw = await FileSystem.readAsStringAsync(uri);
  return JSON.parse(raw) as T;
}

async function writeJson(fileName: string, value: unknown) {
  const uri = getSharedFileUri(fileName);
  if (!uri) {
    return;
  }
  await FileSystem.writeAsStringAsync(uri, JSON.stringify(value));
}

function getSharedFileUri(fileName: string) {
  const container = Paths.appleSharedContainers?.[appGroupIdentifier];
  const baseUri = container?.uri;
  if (!baseUri) {
    return null;
  }
  return `${baseUri.endsWith('/') ? baseUri : `${baseUri}/`}${fileName}`;
}
