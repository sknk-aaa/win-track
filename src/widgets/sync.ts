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
    await clearWidgetEventsPayload();
  }
  await publishWidgetSnapshot([]);
}

export async function publishWidgetSnapshot(pendingEvents: WidgetPendingEvent[] = []) {
  const [counters, slots] = await Promise.all([listCounters(), listWidgetSlots()]);
  const snapshot: WinRateWidgetProps = {
    slots: slots.map((slot) => toSnapshot(slot, counters, pendingEvents)),
    updatedAt: new Date().toISOString()
  };
  const payload = JSON.stringify(snapshot);
  let didSave = true;
  try {
    await saveWidgetSnapshotPayload(payload);
  } catch (error) {
    didSave = false;
    console.warn('Failed to save widget snapshot to shared container', error);
  }
  try {
    await reloadAllWidgetTimelines();
  } catch (error) {
    console.warn('Failed to reload widget timelines', error);
  }
  return didSave;
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
