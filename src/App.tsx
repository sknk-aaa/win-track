import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState, type ComponentProps } from 'react';
import {
  Alert,
  AppState,
  Image,
  InteractionManager,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
  type GestureResponderEvent,
  type ImageSourcePropType
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import {
  archiveCounter,
  assignWidgetSlot,
  createCounter,
  deleteCounterPermanently,
  deleteRecord,
  initializeStore,
  listCounters,
  listHistory,
  listWidgetSlots,
  recordMatch,
  resetAllData,
  restoreCounter,
  restoreRecord,
  undoLastRecord,
  updateCounter
} from './data/store';
import {
  formatFullDate,
  formatShortDate,
  formatWinRate,
  resultLabel,
  summarizeTopLine
} from './lib/format';
import { getTheme, type AppTheme } from './theme';
import {
  getAlternateAppIconName,
  setAlternateAppIconName,
  type AlternateAppIconName
} from './native/WinTrackWidgetBridge';
import type {
  CounterSummary,
  MatchRecord,
  MatchResult,
  WidgetSlot,
  WidgetSlotId
} from './types';
import { publishWidgetSnapshot, reconcileWidgetEvents } from './widgets/sync';

type Tab = 'counters' | 'history' | 'settings';
type IconName = ComponentProps<typeof Ionicons>['name'];
type EditorMode =
  | { type: 'create' }
  | { type: 'edit'; counter: CounterSummary };
type AppIconSelection = 'primary' | AlternateAppIconName;
type AppIconOption = {
  id: AppIconSelection;
  nativeName: AlternateAppIconName | null;
  label: string;
  source: ImageSourcePropType;
};

const slotIds: WidgetSlotId[] = ['slot1', 'slot2', 'slot3'];
const slotDisplayNames: Record<WidgetSlotId, string> = {
  slot1: '枠1',
  slot2: '枠2',
  slot3: '枠3'
};
const appIconOptions: AppIconOption[] = [
  { id: 'primary', nativeName: null, label: '1', source: require('../assets/icon1.png') },
  { id: 'AppIcon2', nativeName: 'AppIcon2', label: '2', source: require('../assets/icon2.png') },
  { id: 'AppIcon3', nativeName: 'AppIcon3', label: '3', source: require('../assets/icon3.png') },
  { id: 'AppIcon4', nativeName: 'AppIcon4', label: '4', source: require('../assets/icon4.png') }
];
const photoDirectoryName = 'counter-photos';

export default function App() {
  return (
    <SafeAreaProvider>
      <Root />
    </SafeAreaProvider>
  );
}

function toAppIconSelection(iconName: AlternateAppIconName | null | undefined): AppIconSelection {
  return iconName ?? 'primary';
}

function Root() {
  const scheme = useColorScheme();
  const theme = useMemo(() => getTheme(scheme), [scheme]);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>('counters');
  const [counters, setCounters] = useState<CounterSummary[]>([]);
  const [allCounters, setAllCounters] = useState<CounterSummary[]>([]);
  const [history, setHistory] = useState<MatchRecord[]>([]);
  const [historyFilter, setHistoryFilter] = useState<string | null>(null);
  const [detailRecords, setDetailRecords] = useState<MatchRecord[]>([]);
  const [slots, setSlots] = useState<WidgetSlot[]>([]);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorMode | null>(null);
  const [slotEditor, setSlotEditor] = useState<WidgetSlotId | null>(null);
  const [deletedRecord, setDeletedRecord] = useState<MatchRecord | null>(null);
  const [currentAppIcon, setCurrentAppIcon] = useState<AppIconSelection>('primary');
  const [selectedAppIcon, setSelectedAppIcon] = useState<AppIconSelection>('primary');
  const [isApplyingAppIcon, setIsApplyingAppIcon] = useState(false);
  const [startupError, setStartupError] = useState<string | null>(null);

  const selectedCounter = counters.find((counter) => counter.id === detailId) ?? null;
  const archivedCounters = allCounters.filter((counter) => counter.isArchived);
  const totals = useMemo(() => summarizeTopLine(counters), [counters]);
  const countersByCreatedAt = useMemo(
    () => [...counters].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [counters]
  );
  const headerTitle = tab === 'counters' ? 'カウンター' : tab === 'history' ? '履歴' : '設定';
  const headerMeta =
    tab === 'counters'
      ? `${totals.total}戦 / ${totals.winRateLabel}`
      : tab === 'history'
        ? `${history.length}件`
        : 'ウィジェットとデータ';

  const loadData = useCallback(async (filterCounterId: string | null) => {
    const [active, all, records, widgetSlots] = await Promise.all([
      listCounters(),
      listCounters({ includeArchived: true }),
      listHistory(filterCounterId),
      listWidgetSlots()
    ]);
    setCounters(active);
    setAllCounters(all);
    setHistory(records);
    setSlots(widgetSlots);
  }, []);

  const load = useCallback(async () => {
    await loadData(historyFilter);
  }, [historyFilter, loadData]);

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      try {
        await initializeStore();
      } catch (error) {
        console.warn('Failed to initialize store', error);
        if (!cancelled) {
          setStartupError('データベースの準備に失敗しました。アプリを再起動してください。');
          setReady(true);
        }
        return;
      }
      try {
        await reconcileWidgetEvents();
      } catch (error) {
        console.warn('Failed to reconcile widget events', error);
      }
      try {
        await loadData(null);
      } catch (error) {
        console.warn('Failed to load initial data', error);
        if (!cancelled) {
          setStartupError('データの読み込みに失敗しました。アプリを再起動してください。');
        }
      } finally {
        if (!cancelled) {
          setReady(true);
        }
      }
    }
    void boot();
    return () => {
      cancelled = true;
    };
  }, [loadData]);

  useEffect(() => {
    if (ready) {
      void load();
    }
  }, [historyFilter, load, ready]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void reconcileWidgetEvents()
          .catch((error) => console.warn('Failed to reconcile widget events', error))
          .then(load)
          .catch((error) => console.warn('Failed to reload app data', error));
      }
    });
    return () => subscription.remove();
  }, [load]);

  useEffect(() => {
    if (!deletedRecord) {
      return;
    }
    const timer = setTimeout(() => setDeletedRecord(null), 4500);
    return () => clearTimeout(timer);
  }, [deletedRecord]);

  useEffect(() => {
    let cancelled = false;
    async function loadAppIcon() {
      const iconName = await getAlternateAppIconName();
      if (!cancelled) {
        const selection = toAppIconSelection(iconName);
        setCurrentAppIcon(selection);
        setSelectedAppIcon(selection);
      }
    }
    void loadAppIcon();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadDetailRecords() {
      if (!detailId) {
        setDetailRecords([]);
        return;
      }
      const records = await listHistory(detailId);
      if (!cancelled) {
        setDetailRecords(records.slice(0, 6));
      }
    }
    void loadDetailRecords();
    return () => {
      cancelled = true;
    };
  }, [detailId, selectedCounter?.lastRecordedAt, selectedCounter?.wins, selectedCounter?.losses]);

  const refreshAfterMutation = useCallback(async () => {
    await load();
    await publishWidgetSnapshot();
  }, [load]);

  const handleRecord = useCallback(
    async (counterId: string, result: MatchResult) => {
      await recordMatch(counterId, result);
      await Haptics.impactAsync(
        result === 'win' ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium
      );
      await refreshAfterMutation();
    },
    [refreshAfterMutation]
  );

  const handleSaveCounter = useCallback(
    async (name: string, photoUri: string | null, mode: EditorMode) => {
      const storedPhotoUri = photoUri ? await persistPhoto(photoUri) : null;
      if (mode.type === 'create') {
        await createCounter(name, storedPhotoUri);
      } else {
        await updateCounter(mode.counter.id, name, storedPhotoUri);
        if (mode.counter.photoUri !== storedPhotoUri) {
          await deleteStoredPhoto(mode.counter.photoUri);
        }
      }
      setEditor(null);
      await refreshAfterMutation();
    },
    [refreshAfterMutation]
  );

  const handleAssignSlot = useCallback(
    async (slotId: WidgetSlotId, counterId: string | null) => {
      await assignWidgetSlot(slotId, counterId);
      setSlotEditor(null);
      await refreshAfterMutation();
    },
    [refreshAfterMutation]
  );

  const handleDeleteHistoryRecord = useCallback(
    async (record: MatchRecord) => {
      await deleteRecord(record.id);
      setDeletedRecord(record);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await refreshAfterMutation();
    },
    [refreshAfterMutation]
  );

  const handleUndoDelete = useCallback(async () => {
    if (!deletedRecord) {
      return;
    }
    const record = deletedRecord;
    setDeletedRecord(null);
    await restoreRecord(record);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await refreshAfterMutation();
  }, [deletedRecord, refreshAfterMutation]);

  const handleOpenDetailEditor = useCallback((counter: CounterSummary) => {
    setDetailId(null);
    InteractionManager.runAfterInteractions(() => {
      setEditor({ type: 'edit', counter });
    });
  }, []);

  const handleApplyAppIcon = useCallback(async () => {
    if (selectedAppIcon === currentAppIcon || isApplyingAppIcon) {
      return;
    }
    const icon = appIconOptions.find((option) => option.id === selectedAppIcon);
    if (!icon) {
      return;
    }
    setIsApplyingAppIcon(true);
    try {
      const appliedIconName = await setAlternateAppIconName(icon.nativeName);
      const appliedSelection = toAppIconSelection(appliedIconName);
      setCurrentAppIcon(appliedSelection);
      setSelectedAppIcon(appliedSelection);
    } catch (error) {
      console.warn('Failed to apply app icon', error);
      Alert.alert('変更できませんでした', '時間をおいてもう一度お試しください。');
    } finally {
      setIsApplyingAppIcon(false);
    }
  }, [currentAppIcon, isApplyingAppIcon, selectedAppIcon]);

  if (!ready) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.background }]}>
        <StatusBar style={theme.isDark ? 'light' : 'dark'} />
        <View style={styles.loadingWrap}>
          <Text style={[styles.loadingTitle, { color: theme.colors.text }]}>勝率カウンター</Text>
          <Text style={[styles.loadingText, { color: theme.colors.muted }]}>準備中</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (startupError) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.background }]}>
        <StatusBar style={theme.isDark ? 'light' : 'dark'} />
        <View style={styles.emptyWrap}>
          <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>起動に失敗しました</Text>
          <Text style={[styles.emptyText, { color: theme.colors.muted }]}>{startupError}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />
      <View style={styles.header}>
        <View>
          <Text style={[styles.appTitle, { color: theme.colors.text }]}>{headerTitle}</Text>
          <Text style={[styles.headerMeta, { color: theme.colors.muted }]}>{headerMeta}</Text>
        </View>
        {tab === 'counters' ? (
          <IconButton
            icon="add"
            label="カウンター作成"
            theme={theme}
            onPress={() => setEditor({ type: 'create' })}
          />
        ) : null}
      </View>

      {tab === 'counters' ? (
        <CountersScreen
          counters={countersByCreatedAt}
          theme={theme}
          onCreate={() => setEditor({ type: 'create' })}
          onRecord={handleRecord}
          onOpen={setDetailId}
        />
      ) : null}
      {tab === 'history' ? (
        <HistoryScreen
          counters={counters}
          history={history}
          filter={historyFilter}
          theme={theme}
          onChangeFilter={setHistoryFilter}
          onDelete={(record) => void handleDeleteHistoryRecord(record)}
        />
      ) : null}
      {tab === 'settings' ? (
        <SettingsScreen
          counters={counters}
          archivedCounters={archivedCounters}
          slots={slots}
          theme={theme}
          onEditSlot={setSlotEditor}
          appIconOptions={appIconOptions}
          selectedAppIcon={selectedAppIcon}
          currentAppIcon={currentAppIcon}
          isApplyingAppIcon={isApplyingAppIcon}
          onSelectAppIcon={setSelectedAppIcon}
          onApplyAppIcon={() => void handleApplyAppIcon()}
          onRestore={(counter) => void restoreCounter(counter.id).then(refreshAfterMutation)}
          onDeleteCounter={(counter) => {
            Alert.alert('完全に削除しますか？', 'このカウンターと履歴は元に戻せません。', [
              { text: 'キャンセル', style: 'cancel' },
              {
                text: '完全削除',
                style: 'destructive',
                onPress: () => {
                  void deleteCounterPermanently(counter.id)
                    .then(() => deleteStoredPhoto(counter.photoUri))
                    .then(refreshAfterMutation);
                }
              }
            ]);
          }}
          onResetAll={() => {
            Alert.alert('全データを削除しますか？', 'すべてのカウンター、写真設定、履歴を削除します。', [
              { text: 'キャンセル', style: 'cancel' },
              {
                text: '全削除',
                style: 'destructive',
                onPress: () => {
                  void resetAllData()
                    .then(deletePhotoDirectory)
                    .then(refreshAfterMutation);
                }
              }
            ]);
          }}
        />
      ) : null}

      <TabBar active={tab} theme={theme} onChange={setTab} />

      {deletedRecord ? <UndoToast theme={theme} onUndo={() => void handleUndoDelete()} /> : null}

      {selectedCounter ? (
        <CounterDetail
          counter={selectedCounter}
          records={detailRecords}
          theme={theme}
          onClose={() => setDetailId(null)}
          onRecord={handleRecord}
          onUndo={() => void undoLastRecord(selectedCounter.id).then(refreshAfterMutation)}
          onEdit={() => handleOpenDetailEditor(selectedCounter)}
          onArchive={() => {
            Alert.alert('アーカイブしますか？', '通常の一覧と履歴には表示されなくなります。', [
              { text: 'キャンセル', style: 'cancel' },
              {
                text: 'アーカイブ',
                style: 'destructive',
                onPress: () => {
                  setDetailId(null);
                  void archiveCounter(selectedCounter.id).then(refreshAfterMutation);
                }
              }
            ]);
          }}
        />
      ) : null}

      {editor ? (
        <CounterEditor
          mode={editor}
          theme={theme}
          onCancel={() => setEditor(null)}
          onSave={handleSaveCounter}
        />
      ) : null}

      {slotEditor ? (
        <SlotEditor
          slotId={slotEditor}
          counters={counters}
          selectedCounterId={slots.find((slot) => slot.id === slotEditor)?.counterId ?? null}
          theme={theme}
          onCancel={() => setSlotEditor(null)}
          onSave={handleAssignSlot}
        />
      ) : null}
    </SafeAreaView>
  );
}

function CountersScreen({
  counters,
  theme,
  onCreate,
  onRecord,
  onOpen
}: {
  counters: CounterSummary[];
  theme: AppTheme;
  onCreate: () => void;
  onRecord: (counterId: string, result: MatchResult) => Promise<void>;
  onOpen: (counterId: string) => void;
}) {
  if (counters.length === 0) {
    return (
      <View style={styles.firstCounterWrap}>
        <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>まずはカウンターを作成しましょう</Text>
        <Text style={[styles.emptyText, { color: theme.colors.muted }]}>
          設定項目は名前と写真だけです。写真は任意なので、名前だけですぐ始められます。
        </Text>
        <View style={styles.firstCounterButton}>
          <PrimaryButton label="カウンターを作成" theme={theme} onPress={onCreate} />
        </View>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      {counters.map((counter) => (
        <CounterCard
          key={counter.id}
          counter={counter}
          theme={theme}
          onOpen={() => onOpen(counter.id)}
          onRecord={(result) => onRecord(counter.id, result)}
        />
      ))}
    </ScrollView>
  );
}

function CounterCard({
  counter,
  theme,
  onOpen,
  onRecord
}: {
  counter: CounterSummary;
  theme: AppTheme;
  onOpen: () => void;
  onRecord: (result: MatchResult) => Promise<void>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${counter.name} 詳細`}
      onPress={onOpen}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          opacity: pressed ? 0.82 : 1
        }
      ]}>
      <View style={styles.cardTop}>
        <Avatar counter={counter} theme={theme} size={58} />
        <View style={styles.cardTitleArea}>
          <Text numberOfLines={1} style={[styles.counterName, { color: theme.colors.text }]}>
            {counter.name}
          </Text>
          <Text style={[styles.counterMeta, { color: theme.colors.muted }]}>
            {counter.total}戦 / {counter.wins}勝 {counter.losses}負
          </Text>
        </View>
        <Text style={[styles.winRate, { color: theme.colors.text }]}>
          {formatWinRate(counter.wins, counter.losses)}
        </Text>
      </View>
      <View style={styles.recordRow}>
        <RecordButton result="win" theme={theme} onPress={() => onRecord('win')} />
        <RecordButton result="loss" theme={theme} onPress={() => onRecord('loss')} />
      </View>
    </Pressable>
  );
}

function HistoryScreen({
  counters,
  history,
  filter,
  theme,
  onChangeFilter,
  onDelete
}: {
  counters: CounterSummary[];
  history: MatchRecord[];
  filter: string | null;
  theme: AppTheme;
  onChangeFilter: (counterId: string | null) => void;
  onDelete: (record: MatchRecord) => void;
}) {
  return (
    <View style={styles.flex}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRail}>
        <FilterChip label="すべて" active={filter === null} theme={theme} onPress={() => onChangeFilter(null)} />
        {counters.map((counter) => (
          <FilterChip
            key={counter.id}
            label={counter.name}
            active={filter === counter.id}
            theme={theme}
            onPress={() => onChangeFilter(counter.id)}
          />
        ))}
      </ScrollView>
      {history.length === 0 ? (
        <View style={styles.historyEmptyWrap}>
          <Text style={[styles.historyEmptyTitle, { color: theme.colors.text }]}>履歴はまだありません</Text>
          <Text style={[styles.historyEmptyText, { color: theme.colors.muted }]}>
            勝ち/負けを記録するとここに並びます。
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {history.map((record) => (
            <HistoryRow key={record.id} record={record} theme={theme} onDelete={() => onDelete(record)} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function SettingsScreen({
  counters,
  archivedCounters,
  slots,
  theme,
  onEditSlot,
  appIconOptions,
  selectedAppIcon,
  currentAppIcon,
  isApplyingAppIcon,
  onSelectAppIcon,
  onApplyAppIcon,
  onRestore,
  onDeleteCounter,
  onResetAll
}: {
  counters: CounterSummary[];
  archivedCounters: CounterSummary[];
  slots: WidgetSlot[];
  theme: AppTheme;
  onEditSlot: (slotId: WidgetSlotId) => void;
  appIconOptions: AppIconOption[];
  selectedAppIcon: AppIconSelection;
  currentAppIcon: AppIconSelection;
  isApplyingAppIcon: boolean;
  onSelectAppIcon: (icon: AppIconSelection) => void;
  onApplyAppIcon: () => void;
  onRestore: (counter: CounterSummary) => void;
  onDeleteCounter: (counter: CounterSummary) => void;
  onResetAll: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <SectionTitle title="ウィジェット枠" theme={theme} />
      <Text style={[styles.note, { color: theme.colors.muted }]}>
        ロック画面ウィジェットは初期状態で枠1を表示します。
      </Text>
      {slotIds.map((slotId) => {
        const slot = slots.find((candidate) => candidate.id === slotId);
        const counter = counters.find((candidate) => candidate.id === slot?.counterId);
        return (
          <SettingsRow
            key={slotId}
            icon="apps"
            title={slot?.label ?? slotId}
            value={counter?.name ?? '未設定'}
            theme={theme}
            onPress={() => onEditSlot(slotId)}
          />
        );
      })}

      <SectionTitle title="アーカイブ" theme={theme} />
      {archivedCounters.length === 0 ? (
        <Text style={[styles.note, { color: theme.colors.muted }]}>アーカイブ済みカウンターはありません。</Text>
      ) : (
        archivedCounters.map((counter) => (
          <View key={counter.id} style={[styles.archiveRow, { borderColor: theme.colors.border }]}>
            <Text style={[styles.archiveName, { color: theme.colors.text }]}>{counter.name}</Text>
            <View style={styles.archiveActions}>
              <SmallTextButton label="復元" theme={theme} onPress={() => onRestore(counter)} />
              <SmallTextButton danger label="完全削除" theme={theme} onPress={() => onDeleteCounter(counter)} />
            </View>
          </View>
        ))
      )}

      <SectionTitle title="データ" theme={theme} />
      <DangerButton label="すべてのデータを削除" theme={theme} onPress={onResetAll} />

      <SectionTitle title="アプリアイコン" theme={theme} />
      <AppIconPicker
        options={appIconOptions}
        selected={selectedAppIcon}
        current={currentAppIcon}
        isApplying={isApplyingAppIcon}
        theme={theme}
        onSelect={onSelectAppIcon}
        onApply={onApplyAppIcon}
      />

      <SectionTitle title="アプリ情報" theme={theme} />
      <Text style={[styles.note, { color: theme.colors.muted }]}>
        勝率カウンター 0.1.0 / データはこの端末内だけに保存されます。
      </Text>
    </ScrollView>
  );
}

function CounterDetail({
  counter,
  records,
  theme,
  onClose,
  onRecord,
  onUndo,
  onEdit,
  onArchive
}: {
  counter: CounterSummary;
  records: MatchRecord[];
  theme: AppTheme;
  onClose: () => void;
  onRecord: (counterId: string, result: MatchResult) => Promise<void>;
  onUndo: () => void;
  onEdit: () => void;
  onArchive: () => void;
}) {
  return (
    <Modal animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[styles.modalRoot, { backgroundColor: theme.colors.background }]}>
        <ModalHeader title={counter.name} theme={theme} onClose={onClose} />
        <ScrollView contentContainerStyle={styles.modalContent}>
          <View style={[styles.heroPanel, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Avatar counter={counter} theme={theme} size={96} />
            <Text style={[styles.detailRate, { color: theme.colors.text }]}>
              {formatWinRate(counter.wins, counter.losses)}
            </Text>
            <Text style={[styles.counterMeta, { color: theme.colors.muted }]}>
              {counter.total}戦 / {counter.wins}勝 {counter.losses}負
            </Text>
            <View style={styles.recordRow}>
              <RecordButton result="win" theme={theme} onPress={() => onRecord(counter.id, 'win')} />
              <RecordButton result="loss" theme={theme} onPress={() => onRecord(counter.id, 'loss')} />
            </View>
          </View>

          <View style={styles.detailActions}>
            <PrimaryButton label="直前を取り消す" theme={theme} onPress={onUndo} />
            <SecondaryButton label="編集" theme={theme} onPress={onEdit} />
            <DangerButton label="アーカイブ" theme={theme} onPress={onArchive} />
          </View>

          <SectionTitle title="最近の履歴" theme={theme} />
          {records.length === 0 ? (
            <Text style={[styles.note, { color: theme.colors.muted }]}>まだ記録がありません。</Text>
          ) : (
            records.map((record) => <HistoryRow key={record.id} record={record} theme={theme} compact />)
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function CounterEditor({
  mode,
  theme,
  onCancel,
  onSave
}: {
  mode: EditorMode;
  theme: AppTheme;
  onCancel: () => void;
  onSave: (name: string, photoUri: string | null, mode: EditorMode) => Promise<void>;
}) {
  const [name, setName] = useState(mode.type === 'edit' ? mode.counter.name : '');
  const [photoUri, setPhotoUri] = useState<string | null>(
    mode.type === 'edit' ? mode.counter.photoUri : null
  );
  const canSave = name.trim().length > 0;

  const pickImage = async (source: 'library' | 'camera') => {
    const permission =
      source === 'library'
        ? await ImagePicker.requestMediaLibraryPermissionsAsync()
        : await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('権限が必要です', '写真を登録するには権限を許可してください。');
      return;
    }
    const result =
      source === 'library'
        ? await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.9
          })
        : await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.9
          });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  return (
    <Modal animationType="slide" presentationStyle="pageSheet" onRequestClose={onCancel}>
      <SafeAreaView style={[styles.modalRoot, { backgroundColor: theme.colors.background }]}>
        <ModalHeader
          title={mode.type === 'create' ? 'カウンター作成' : 'カウンター編集'}
          theme={theme}
          onClose={onCancel}
        />
        <ScrollView contentContainerStyle={styles.modalContent}>
          {mode.type === 'create' ? (
            <View style={[styles.editorHint, { backgroundColor: theme.colors.surfaceSubtle }]}>
              <Ionicons name="checkmark-circle" size={22} color={theme.colors.win} />
              <View style={styles.editorHintTextArea}>
                <Text style={[styles.editorHintTitle, { color: theme.colors.text }]}>名前だけで開始できます</Text>
                <Text style={[styles.editorHintText, { color: theme.colors.muted }]}>
                  写真は任意です。あとからいつでも追加できます。
                </Text>
              </View>
            </View>
          ) : null}
          <Text style={[styles.inputLabel, { color: theme.colors.muted }]}>名前</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="チームA"
            placeholderTextColor={theme.colors.muted}
            style={[
              styles.input,
              {
                color: theme.colors.text,
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border
              }
            ]}
            maxLength={32}
            autoFocus
          />
          <Text style={[styles.inputLabel, { color: theme.colors.muted }]}>写真（任意）</Text>
          <View style={styles.editorPhotoWrap}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.editorPhoto} />
            ) : (
              <View style={[styles.editorPhotoEmpty, { backgroundColor: theme.colors.surfaceSubtle }]}>
                <Ionicons name="image-outline" size={34} color={theme.colors.muted} />
              </View>
            )}
          </View>
          <View style={styles.photoActions}>
            <SecondaryButton label="写真を選択" theme={theme} onPress={() => void pickImage('library')} />
            <SecondaryButton label="カメラで撮影" theme={theme} onPress={() => void pickImage('camera')} />
            {photoUri ? <DangerButton label="写真削除" theme={theme} onPress={() => setPhotoUri(null)} /> : null}
          </View>
          <PrimaryButton
            disabled={!canSave}
            label={mode.type === 'create' ? '作成する' : '保存'}
            theme={theme}
            onPress={() => void onSave(name, photoUri, mode)}
          />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function SlotEditor({
  slotId,
  counters,
  selectedCounterId,
  theme,
  onCancel,
  onSave
}: {
  slotId: WidgetSlotId;
  counters: CounterSummary[];
  selectedCounterId: string | null;
  theme: AppTheme;
  onCancel: () => void;
  onSave: (slotId: WidgetSlotId, counterId: string | null) => Promise<void>;
}) {
  const selectedCounter = counters.find((counter) => counter.id === selectedCounterId) ?? null;
  return (
    <Modal animationType="slide" presentationStyle="pageSheet" onRequestClose={onCancel}>
      <SafeAreaView style={[styles.modalRoot, { backgroundColor: theme.colors.background }]}>
        <ModalHeader title={`${slotDisplayNames[slotId]}の割り当て`} theme={theme} onClose={onCancel} />
        <ScrollView contentContainerStyle={styles.modalContent}>
          <View style={[styles.slotSummary, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <View style={[styles.slotSummaryIcon, { backgroundColor: theme.colors.surfaceSubtle }]}>
              <Ionicons name="apps" size={22} color={theme.colors.accent} />
            </View>
            <View style={styles.slotSummaryTextArea}>
              <Text style={[styles.slotSummaryLabel, { color: theme.colors.muted }]}>現在の表示</Text>
              <Text style={[styles.slotSummaryTitle, { color: theme.colors.text }]}>
                {selectedCounter?.name ?? '未設定'}
              </Text>
              <Text style={[styles.slotSummaryText, { color: theme.colors.muted }]}>
                下から選ぶと、この枠にすぐ保存されます。
              </Text>
            </View>
          </View>
          <SectionTitle title="表示するカウンター" theme={theme} />
          <SlotChoiceRow
            title="割り当てなし"
            meta="この枠を空にします"
            selected={selectedCounterId === null}
            theme={theme}
            icon="remove-circle-outline"
            onPress={() => void onSave(slotId, null)}
          />
          {counters.map((counter) => (
            <SlotChoiceRow
              key={counter.id}
              counter={counter}
              title={counter.name}
              meta={`${counter.total}戦 / ${formatWinRate(counter.wins, counter.losses)}`}
              selected={selectedCounterId === counter.id}
              theme={theme}
              onPress={() => void onSave(slotId, counter.id)}
            />
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function SlotChoiceRow({
  counter,
  icon,
  title,
  meta,
  selected,
  theme,
  onPress
}: {
  counter?: CounterSummary;
  icon?: IconName;
  title: string;
  meta: string;
  selected: boolean;
  theme: AppTheme;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.slotChoiceRow,
        {
          backgroundColor: selected ? theme.colors.surfaceSubtle : theme.colors.surface,
          borderColor: selected ? theme.colors.accent : theme.colors.border,
          opacity: pressed ? 0.82 : 1
        }
      ]}>
      {counter ? (
        <Avatar counter={counter} theme={theme} size={44} />
      ) : (
        <View style={[styles.slotChoiceIcon, { backgroundColor: theme.colors.surfaceSubtle }]}>
          <Ionicons name={icon ?? 'ellipse-outline'} size={22} color={theme.colors.muted} />
        </View>
      )}
      <View style={styles.slotChoiceTextArea}>
        <Text numberOfLines={1} style={[styles.slotChoiceTitle, { color: theme.colors.text }]}>
          {title}
        </Text>
        <Text style={[styles.slotChoiceMeta, { color: theme.colors.muted }]}>{meta}</Text>
      </View>
      <Ionicons
        name={selected ? 'checkmark-circle' : 'ellipse-outline'}
        size={24}
        color={selected ? theme.colors.accent : theme.colors.muted}
      />
    </Pressable>
  );
}

function AppIconPicker({
  options,
  selected,
  current,
  isApplying,
  theme,
  onSelect,
  onApply
}: {
  options: AppIconOption[];
  selected: AppIconSelection;
  current: AppIconSelection;
  isApplying: boolean;
  theme: AppTheme;
  onSelect: (icon: AppIconSelection) => void;
  onApply: () => void;
}) {
  return (
    <View style={[styles.appIconPanel, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      <View style={styles.appIconGrid}>
        {options.map((option) => {
          const isSelected = selected === option.id;
          const isCurrent = current === option.id;
          return (
            <Pressable
              key={option.id}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`アプリアイコン${option.label}`}
              onPress={() => onSelect(option.id)}
              style={({ pressed }) => [
                styles.appIconChoice,
                {
                  borderColor: isSelected ? theme.colors.accent : theme.colors.border,
                  backgroundColor: isSelected ? theme.colors.surfaceSubtle : theme.colors.surface,
                  opacity: pressed ? 0.82 : 1
                }
              ]}>
              <Image source={option.source} style={styles.appIconImage} />
              <View style={styles.appIconChoiceFooter}>
                <Text style={[styles.appIconLabel, { color: theme.colors.text }]}>{option.label}</Text>
                {isSelected ? (
                  <Ionicons name="checkmark-circle" size={18} color={theme.colors.accent} />
                ) : null}
              </View>
              {isCurrent ? (
                <View style={[styles.appIconCurrentBadge, { backgroundColor: theme.colors.text }]}>
                  <Text style={[styles.appIconCurrentText, { color: theme.colors.background }]}>使用中</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
      <PrimaryButton
        disabled={selected === current || isApplying}
        label={isApplying ? '変更中' : '決定'}
        theme={theme}
        onPress={onApply}
      />
    </View>
  );
}

function TabBar({
  active,
  theme,
  onChange
}: {
  active: Tab;
  theme: AppTheme;
  onChange: (tab: Tab) => void;
}) {
  return (
    <View style={[styles.tabBar, { backgroundColor: theme.colors.tab, borderColor: theme.colors.border }]}>
      <TabButton icon="albums" label="カウンター" active={active === 'counters'} theme={theme} onPress={() => onChange('counters')} />
      <TabButton icon="time" label="履歴" active={active === 'history'} theme={theme} onPress={() => onChange('history')} />
      <TabButton icon="settings" label="設定" active={active === 'settings'} theme={theme} onPress={() => onChange('settings')} />
    </View>
  );
}

function TabButton({
  icon,
  label,
  active,
  theme,
  onPress
}: {
  icon: IconName;
  label: string;
  active: boolean;
  theme: AppTheme;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={onPress} style={styles.tabButton}>
      <Ionicons name={icon} size={22} color={active ? theme.colors.text : theme.colors.muted} />
      <Text style={[styles.tabText, { color: active ? theme.colors.text : theme.colors.muted }]}>{label}</Text>
    </Pressable>
  );
}

function Avatar({ counter, theme, size }: { counter: CounterSummary; theme: AppTheme; size: number }) {
  if (counter.photoUri) {
    return <Image source={{ uri: counter.photoUri }} style={{ width: size, height: size, borderRadius: 18 }} />;
  }
  return (
    <View
      style={[
        styles.avatarEmpty,
        {
          width: size,
          height: size,
          borderRadius: 18,
          backgroundColor: theme.colors.surfaceSubtle
        }
      ]}>
      <Text style={[styles.avatarLetter, { color: theme.colors.accent }]}>{counter.name.slice(0, 1)}</Text>
    </View>
  );
}

function RecordButton({
  result,
  theme,
  onPress
}: {
  result: MatchResult;
  theme: AppTheme;
  onPress: (event: GestureResponderEvent) => void;
}) {
  const isWin = result === 'win';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={isWin ? '勝ちを記録' : '負けを記録'}
      onPress={onPress}
      style={({ pressed }) => [
        styles.recordButton,
        {
          backgroundColor: isWin ? theme.colors.win : theme.colors.loss,
          transform: [{ scale: pressed ? 0.98 : 1 }]
        }
      ]}>
      <Ionicons name={isWin ? 'checkmark' : 'close'} size={20} color="#FFFFFF" />
      <Text style={styles.recordButtonText}>{isWin ? '勝ち' : '負け'}</Text>
    </Pressable>
  );
}

function HistoryRow({
  record,
  theme,
  compact,
  onDelete
}: {
  record: MatchRecord;
  theme: AppTheme;
  compact?: boolean;
  onDelete?: () => void;
}) {
  const isWin = record.result === 'win';
  return (
    <View
      style={[
        styles.historyRow,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border
        },
        compact ? styles.historyCompact : null
      ]}>
      <View
        style={[
          styles.resultPill,
          {
            backgroundColor: isWin ? theme.colors.win : theme.colors.loss
          }
        ]}>
        <Text style={styles.resultPillText}>{resultLabel(record.result)}</Text>
      </View>
      <View style={styles.historyTextArea}>
        <Text style={[styles.historyName, { color: theme.colors.text }]}>{record.counterName}</Text>
        <Text style={[styles.historyDate, { color: theme.colors.muted }]}>
          {compact ? formatShortDate(record.createdAt) : formatFullDate(record.createdAt)}
        </Text>
      </View>
      {onDelete ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="履歴を削除"
          hitSlop={8}
          onPress={onDelete}
          style={styles.historyDeleteButton}>
          <Ionicons name="trash-outline" size={20} color={theme.colors.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}

function SettingsRow({
  icon,
  title,
  value,
  theme,
  onPress
}: {
  icon: IconName;
  title: string;
  value: string;
  theme: AppTheme;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.settingsRow,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          opacity: pressed ? 0.82 : 1
        }
      ]}>
      <Ionicons name={icon} size={20} color={theme.colors.accent} />
      <Text style={[styles.settingsTitle, { color: theme.colors.text }]}>{title}</Text>
      <Text numberOfLines={1} style={[styles.settingsValue, { color: theme.colors.muted }]}>
        {value}
      </Text>
      <Ionicons name="chevron-forward" size={18} color={theme.colors.muted} />
    </Pressable>
  );
}

function SectionTitle({ title, theme }: { title: string; theme: AppTheme }) {
  return <Text style={[styles.sectionTitle, { color: theme.colors.muted }]}>{title}</Text>;
}

function ModalHeader({
  title,
  theme,
  onClose
}: {
  title: string;
  theme: AppTheme;
  onClose: () => void;
}) {
  return (
    <View style={[styles.modalHeader, { borderColor: theme.colors.border }]}>
      <Text style={[styles.modalTitle, { color: theme.colors.text }]}>{title}</Text>
      <IconButton icon="close" label="閉じる" theme={theme} onPress={onClose} />
    </View>
  );
}

function IconButton({
  icon,
  label,
  theme,
  onPress
}: {
  icon: IconName;
  label: string;
  theme: AppTheme;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          opacity: pressed ? 0.75 : 1
        }
      ]}>
      <Ionicons name={icon} size={22} color={theme.colors.text} />
    </Pressable>
  );
}

function FilterChip({
  label,
  active,
  theme,
  onPress
}: {
  label: string;
  active: boolean;
  theme: AppTheme;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[
        styles.filterChip,
        {
          backgroundColor: active ? theme.colors.text : theme.colors.surface,
          borderColor: theme.colors.border
        }
      ]}>
      <Text style={[styles.filterChipText, { color: active ? theme.colors.background : theme.colors.text }]}>
        {label}
      </Text>
    </Pressable>
  );
}

function PrimaryButton({
  label,
  theme,
  disabled,
  onPress
}: {
  label: string;
  theme: AppTheme;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        {
          backgroundColor: disabled ? theme.colors.faint : theme.colors.text,
          opacity: pressed ? 0.82 : 1
        }
      ]}>
      <Text style={[styles.primaryButtonText, { color: theme.colors.background }]}>{label}</Text>
    </Pressable>
  );
}

function SecondaryButton({ label, theme, onPress }: { label: string; theme: AppTheme; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.secondaryButton,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          opacity: pressed ? 0.78 : 1
        }
      ]}>
      <Text style={[styles.secondaryButtonText, { color: theme.colors.text }]}>{label}</Text>
    </Pressable>
  );
}

function DangerButton({ label, theme, onPress }: { label: string; theme: AppTheme; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.secondaryButton,
        {
          backgroundColor: `${theme.colors.danger}18`,
          borderColor: `${theme.colors.danger}55`,
          opacity: pressed ? 0.78 : 1
        }
      ]}>
      <Text style={[styles.secondaryButtonText, { color: theme.colors.danger }]}>{label}</Text>
    </Pressable>
  );
}

function SmallTextButton({
  label,
  danger,
  theme,
  onPress
}: {
  label: string;
  danger?: boolean;
  theme: AppTheme;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={8}>
      <Text style={[styles.smallTextButton, { color: danger ? theme.colors.danger : theme.colors.accent }]}>
        {label}
      </Text>
    </Pressable>
  );
}

function UndoToast({ theme, onUndo }: { theme: AppTheme; onUndo: () => void }) {
  return (
    <View
      style={[
        styles.undoToast,
        {
          backgroundColor: theme.colors.text,
          shadowColor: '#000000'
        }
      ]}>
      <Text style={[styles.undoToastText, { color: theme.colors.background }]}>削除しました</Text>
      <Pressable accessibilityRole="button" onPress={onUndo} hitSlop={8} style={styles.undoToastAction}>
        <Text style={[styles.undoToastActionText, { color: theme.colors.background }]}>取り消し</Text>
      </Pressable>
    </View>
  );
}

async function persistPhoto(uri: string) {
  const directory = getPhotoDirectory();
  if (!directory || isStoredPhotoUri(uri)) {
    return uri;
  }
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  const extension = uri.split('.').pop()?.split('?')[0] ?? 'jpg';
  const target = `${directory}${Date.now().toString(36)}.${extension}`;
  await FileSystem.copyAsync({ from: uri, to: target });
  return target;
}

function getPhotoDirectory() {
  const documentDirectory = FileSystem.documentDirectory;
  return documentDirectory ? `${documentDirectory}${photoDirectoryName}/` : null;
}

function isStoredPhotoUri(uri: string | null) {
  const directory = getPhotoDirectory();
  return !!directory && !!uri && uri.startsWith(directory);
}

async function deleteStoredPhoto(uri: string | null) {
  if (!isStoredPhotoUri(uri) || !uri) {
    return;
  }
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch (error) {
    console.warn('Failed to delete counter photo', error);
  }
}

async function deletePhotoDirectory() {
  const directory = getPhotoDirectory();
  if (!directory) {
    return;
  }
  try {
    await FileSystem.deleteAsync(directory, { idempotent: true });
  } catch (error) {
    console.warn('Failed to delete counter photos', error);
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1
  },
  flex: {
    flex: 1
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6
  },
  loadingTitle: {
    fontSize: 25,
    fontWeight: '800'
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '700'
  },
  header: {
    minHeight: 72,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  appTitle: {
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 0
  },
  headerMeta: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '700'
  },
  iconButton: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 110,
    gap: 12
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 22,
    padding: 14,
    gap: 14
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  cardTitleArea: {
    flex: 1,
    minWidth: 0
  },
  counterName: {
    fontSize: 18,
    fontWeight: '800'
  },
  counterMeta: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '700'
  },
  winRate: {
    fontSize: 25,
    fontWeight: '900',
    letterSpacing: 0
  },
  recordRow: {
    flexDirection: 'row',
    gap: 10
  },
  recordButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6
  },
  recordButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900'
  },
  avatarEmpty: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarLetter: {
    fontSize: 23,
    fontWeight: '900'
  },
  emptyWrap: {
    flex: 1,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center'
  },
  emptyText: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    fontWeight: '600'
  },
  firstCounterWrap: {
    flex: 1,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14
  },
  firstCounterButton: {
    alignSelf: 'stretch',
    marginTop: 4
  },
  filterRail: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
    gap: 8
  },
  filterChip: {
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center'
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '800'
  },
  historyEmptyWrap: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 18,
    gap: 8
  },
  historyEmptyTitle: {
    fontSize: 22,
    fontWeight: '900'
  },
  historyEmptyText: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600'
  },
  historyRow: {
    minHeight: 66,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  historyCompact: {
    minHeight: 58
  },
  resultPill: {
    width: 48,
    height: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  resultPillText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900'
  },
  historyTextArea: {
    flex: 1,
    minWidth: 0
  },
  historyDeleteButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center'
  },
  historyName: {
    fontSize: 16,
    fontWeight: '800'
  },
  historyDate: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: '700'
  },
  settingsRow: {
    minHeight: 58,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  settingsTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800'
  },
  settingsValue: {
    maxWidth: 128,
    fontSize: 13,
    fontWeight: '700'
  },
  slotSummary: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    padding: 14,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center'
  },
  slotSummaryIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center'
  },
  slotSummaryTextArea: {
    flex: 1,
    minWidth: 0
  },
  slotSummaryLabel: {
    fontSize: 12,
    fontWeight: '900'
  },
  slotSummaryTitle: {
    marginTop: 3,
    fontSize: 18,
    fontWeight: '900'
  },
  slotSummaryText: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700'
  },
  slotChoiceRow: {
    minHeight: 68,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  slotChoiceIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center'
  },
  slotChoiceTextArea: {
    flex: 1,
    minWidth: 0
  },
  slotChoiceTitle: {
    fontSize: 16,
    fontWeight: '900'
  },
  slotChoiceMeta: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '700'
  },
  appIconPanel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    padding: 12,
    gap: 12
  },
  appIconGrid: {
    flexDirection: 'row',
    gap: 8
  },
  appIconChoice: {
    flex: 1,
    minWidth: 0,
    borderWidth: 2,
    borderRadius: 18,
    padding: 7,
    gap: 7
  },
  appIconImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 13
  },
  appIconChoiceFooter: {
    minHeight: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  appIconLabel: {
    fontSize: 13,
    fontWeight: '900'
  },
  appIconCurrentBadge: {
    position: 'absolute',
    top: 5,
    left: 5,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 3
  },
  appIconCurrentText: {
    fontSize: 10,
    fontWeight: '900'
  },
  sectionTitle: {
    marginTop: 8,
    marginBottom: 2,
    paddingHorizontal: 4,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0
  },
  note: {
    paddingHorizontal: 4,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600'
  },
  archiveRow: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  archiveName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800'
  },
  archiveActions: {
    flexDirection: 'row',
    gap: 12
  },
  smallTextButton: {
    fontSize: 13,
    fontWeight: '900'
  },
  tabBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 10,
    height: 66,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8
  },
  undoToast: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 88,
    minHeight: 52,
    borderRadius: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10
  },
  undoToastText: {
    fontSize: 15,
    fontWeight: '800'
  },
  undoToastAction: {
    minHeight: 44,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  undoToastActionText: {
    fontSize: 15,
    fontWeight: '900'
  },
  tabButton: {
    minWidth: 86,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3
  },
  tabText: {
    fontSize: 11,
    fontWeight: '800'
  },
  modalRoot: {
    flex: 1
  },
  modalHeader: {
    minHeight: 62,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  modalTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '900'
  },
  modalContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 12
  },
  heroPanel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 24,
    padding: 18,
    alignItems: 'center',
    gap: 10
  },
  detailRate: {
    fontSize: 54,
    fontWeight: '900',
    letterSpacing: 0
  },
  detailActions: {
    gap: 10
  },
  editorHint: {
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  editorHintTextArea: {
    flex: 1,
    minWidth: 0
  },
  editorHintTitle: {
    fontSize: 16,
    fontWeight: '900'
  },
  editorHintText: {
    marginTop: 3,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700'
  },
  editorPhotoWrap: {
    alignItems: 'center',
    paddingVertical: 8
  },
  editorPhoto: {
    width: 132,
    height: 132,
    borderRadius: 28
  },
  editorPhotoEmpty: {
    width: 132,
    height: 132,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center'
  },
  photoActions: {
    gap: 10
  },
  inputLabel: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '900'
  },
  input: {
    height: 54,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    fontSize: 17,
    fontWeight: '800'
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '900'
  },
  secondaryButton: {
    minHeight: 50,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '900'
  }
});
