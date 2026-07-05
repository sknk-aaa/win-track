import { Button, HStack, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  background,
  buttonStyle,
  containerBackground,
  cornerRadius,
  font,
  foregroundStyle,
  frame,
  padding,
  tint
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

import { createId, formatWinRate } from '../lib/format';
import type {
  MatchResult,
  WidgetCounterSnapshot,
  WidgetPendingEvent,
  WidgetSlotId,
  WinRateWidgetProps
} from '../types';

type WidgetConfiguration = {
  slotId?: WidgetSlotId;
};

const emptySlot = (slotId: WidgetSlotId): WidgetCounterSnapshot => ({
  slotId,
  label: slotId === 'slot1' ? '枠1' : slotId === 'slot2' ? '枠2' : '枠3',
  counterId: null,
  name: 'カウンターなし',
  wins: 0,
  losses: 0,
  total: 0,
  winRateLabel: '--%',
  isAvailable: false,
  pendingEvents: []
});

const defaultProps: WinRateWidgetProps = {
  slots: [emptySlot('slot1'), emptySlot('slot2'), emptySlot('slot3')],
  updatedAt: new Date(0).toISOString()
};

function selectSlot(props: WinRateWidgetProps, slotId: WidgetSlotId) {
  return props.slots.find((slot) => slot.slotId === slotId) ?? emptySlot(slotId);
}

function nextSnapshot(props: WinRateWidgetProps, slot: WidgetCounterSnapshot, result: MatchResult) {
  if (!slot.counterId || !slot.isAvailable) {
    return {};
  }
  const event: WidgetPendingEvent = {
    id: createId('widget'),
    slotId: slot.slotId,
    counterId: slot.counterId,
    result,
    createdAt: new Date().toISOString()
  };
  const wins = slot.wins + (result === 'win' ? 1 : 0);
  const losses = slot.losses + (result === 'loss' ? 1 : 0);
  return {
    slots: props.slots.map((candidate) =>
      candidate.slotId === slot.slotId
        ? {
            ...slot,
            wins,
            losses,
            total: wins + losses,
            winRateLabel: formatWinRate(wins, losses),
            pendingEvents: [...slot.pendingEvents, event]
          }
        : candidate
    ),
    updatedAt: event.createdAt
  };
}

function StatButton({
  label,
  color,
  disabled,
  onPress
}: {
  label: string;
  color: string;
  disabled: boolean;
  onPress: () => object;
}) {
  return (
    <Button
      label={label}
      onPress={onPress}
      modifiers={[
        buttonStyle('borderedProminent'),
        tint(disabled ? '#8E8E93' : color),
        frame({ minWidth: 48, minHeight: 32 }),
        cornerRadius(10)
      ]}
    />
  );
}

const WinRateWidgetLayout = (
  props: WinRateWidgetProps,
  environment: WidgetEnvironment<WidgetConfiguration>
) => {
  'widget';
  const slotId = environment.configuration?.slotId ?? 'slot1';
  const safeProps = props.slots.length > 0 ? props : defaultProps;
  const slot = selectSlot(safeProps, slotId);
  const isLock = environment.widgetFamily === 'accessoryRectangular';
  const muted = isLock ? '#FFFFFFCC' : '#6F6A61';
  const text = isLock ? '#FFFFFF' : '#171411';
  const bg = isLock ? '#00000000' : '#F8F4EA';

  if (isLock) {
    return (
      <HStack
        spacing={6}
        modifiers={[padding({ all: 6 }), frame({ maxWidth: 180, alignment: 'leading' })]}>
        <VStack spacing={1} modifiers={[frame({ maxWidth: 88, alignment: 'leading' })]}>
          <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(text)]}>
            {slot.name}
          </Text>
          <Text modifiers={[font({ size: 19, weight: 'bold' }), foregroundStyle(text)]}>
            {slot.winRateLabel}
          </Text>
        </VStack>
        <Spacer />
        <StatButton
          label="勝"
          color="#2FB66D"
          disabled={!slot.isAvailable}
          onPress={() => nextSnapshot(safeProps, slot, 'win')}
        />
        <StatButton
          label="負"
          color="#D9514E"
          disabled={!slot.isAvailable}
          onPress={() => nextSnapshot(safeProps, slot, 'loss')}
        />
      </HStack>
    );
  }

  if (environment.widgetFamily === 'systemMedium') {
    return (
      <HStack
        spacing={12}
        modifiers={[
          padding({ all: 16 }),
          containerBackground(bg, 'widget'),
          frame({ maxWidth: 320, maxHeight: 160, alignment: 'leading' })
        ]}>
        <VStack spacing={7} modifiers={[frame({ maxWidth: 154, alignment: 'leading' })]}>
          <Text modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle(muted)]}>
            {slot.label}
          </Text>
          <Text modifiers={[font({ size: 17, weight: 'semibold' }), foregroundStyle(text)]}>
            {slot.name}
          </Text>
          <Text modifiers={[font({ size: 42, weight: 'bold' }), foregroundStyle(text)]}>
            {slot.winRateLabel}
          </Text>
          <Text modifiers={[font({ size: 12, weight: 'medium' }), foregroundStyle(muted)]}>
            {slot.wins}勝 / {slot.losses}負 / {slot.total}戦
          </Text>
        </VStack>
        <Spacer />
        <VStack spacing={8} modifiers={[frame({ width: 96 })]}>
          <StatButton
            label="勝ち"
            color="#2FB66D"
            disabled={!slot.isAvailable}
            onPress={() => nextSnapshot(safeProps, slot, 'win')}
          />
          <StatButton
            label="負け"
            color="#D9514E"
            disabled={!slot.isAvailable}
            onPress={() => nextSnapshot(safeProps, slot, 'loss')}
          />
        </VStack>
      </HStack>
    );
  }

  return (
    <VStack
      spacing={8}
      modifiers={[
        padding({ all: 14 }),
        containerBackground(bg, 'widget'),
        background(bg),
        frame({ maxWidth: 160, maxHeight: 160, alignment: 'leading' })
      ]}>
      <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(muted)]}>
        {slot.label}
      </Text>
      <Text modifiers={[font({ size: 16, weight: 'semibold' }), foregroundStyle(text)]}>
        {slot.name}
      </Text>
      <Text modifiers={[font({ size: 34, weight: 'bold' }), foregroundStyle(text)]}>
        {slot.winRateLabel}
      </Text>
      <Text modifiers={[font({ size: 12, weight: 'medium' }), foregroundStyle(muted)]}>
        {slot.wins}勝 / {slot.losses}負
      </Text>
      <HStack spacing={8}>
        <StatButton
          label="勝"
          color="#2FB66D"
          disabled={!slot.isAvailable}
          onPress={() => nextSnapshot(safeProps, slot, 'win')}
        />
        <StatButton
          label="負"
          color="#D9514E"
          disabled={!slot.isAvailable}
          onPress={() => nextSnapshot(safeProps, slot, 'loss')}
        />
      </HStack>
    </VStack>
  );
};

const WinRateWidget = createWidget<WinRateWidgetProps, WidgetConfiguration>(
  'WinRateWidget',
  WinRateWidgetLayout
);

export default WinRateWidget;
