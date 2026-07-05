import WinRateWidget from './WinRateWidget';
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
  await publishWidgetSnapshot([]);
}

export async function publishWidgetSnapshot(pendingEvents: WidgetPendingEvent[] = []) {
  const [counters, slots] = await Promise.all([listCounters(), listWidgetSlots()]);
  try {
    WinRateWidget.updateSnapshot({
      slots: slots.map((slot) => toSnapshot(slot, counters, pendingEvents)),
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.warn('Failed to update widget snapshot', error);
  }
}

async function readPendingWidgetEvents() {
  let timeline: Awaited<ReturnType<typeof WinRateWidget.getTimeline>>;
  try {
    timeline = await WinRateWidget.getTimeline();
  } catch (error) {
    console.warn('Failed to read widget timeline', error);
    return [];
  }
  const events = new Map<string, WidgetPendingEvent>();
  for (const entry of timeline) {
    for (const slot of entry.props.slots) {
      for (const event of slot.pendingEvents) {
        events.set(event.id, event);
      }
    }
  }
  return [...events.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
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
