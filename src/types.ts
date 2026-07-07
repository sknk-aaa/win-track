export type MatchResult = 'win' | 'loss';
export type ResultNotation = 'jp' | 'wl';

export type Counter = {
  id: string;
  name: string;
  photoUri: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  lastRecordedAt: string | null;
};

export type CounterSummary = Counter & {
  wins: number;
  losses: number;
  total: number;
};

export type MatchRecord = {
  id: string;
  counterId: string;
  counterName: string;
  result: MatchResult;
  createdAt: string;
};

export type WidgetSlotId = 'slot1' | 'slot2' | 'slot3';

export type WidgetSlot = {
  id: WidgetSlotId;
  label: string;
  counterId: string | null;
};

export type WidgetPendingEvent = {
  id: string;
  slotId: WidgetSlotId;
  counterId: string;
  result: MatchResult;
  createdAt: string;
};

export type WidgetCounterSnapshot = {
  slotId: WidgetSlotId;
  label: string;
  counterId: string | null;
  name: string;
  wins: number;
  losses: number;
  total: number;
  winRateLabel: string;
  resultNotation: ResultNotation;
  isAvailable: boolean;
  pendingEvents: WidgetPendingEvent[];
};

export type WinRateWidgetProps = {
  slots: WidgetCounterSnapshot[];
  updatedAt: string;
};
