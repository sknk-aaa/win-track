import AppIntents
import Foundation
import SwiftUI
import WidgetKit

private let appGroupIdentifier = "group.com.sknkaaa.wintrack"
private let snapshotFileName = "widget-snapshot.json"
private let eventsFileName = "widget-events.json"

struct WidgetSnapshotFile: Codable {
  var slots: [CounterSnapshot]
  var updatedAt: String
}

struct CounterSnapshot: Codable {
  var slotId: String
  var label: String
  var counterId: String?
  var name: String
  var wins: Int
  var losses: Int
  var total: Int
  var winRateLabel: String
  var isAvailable: Bool
  var pendingEvents: [PendingEvent]?
}

struct PendingEvent: Codable, Identifiable {
  var id: String
  var slotId: String
  var counterId: String
  var result: String
  var createdAt: String
}

struct SharedStore {
  static var containerURL: URL? {
    FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupIdentifier)
  }

  static var snapshotURL: URL? {
    containerURL?.appendingPathComponent(snapshotFileName)
  }

  static var eventsURL: URL? {
    containerURL?.appendingPathComponent(eventsFileName)
  }

  static func loadSnapshot() -> WidgetSnapshotFile {
    guard let snapshotURL, let data = try? Data(contentsOf: snapshotURL) else {
      return WidgetSnapshotFile(slots: defaultSlots, updatedAt: ISO8601DateFormatter().string(from: Date()))
    }
    return (try? JSONDecoder().decode(WidgetSnapshotFile.self, from: data))
      ?? WidgetSnapshotFile(slots: defaultSlots, updatedAt: ISO8601DateFormatter().string(from: Date()))
  }

  static func saveSnapshot(_ snapshot: WidgetSnapshotFile) {
    guard let snapshotURL, let data = try? JSONEncoder().encode(snapshot) else {
      return
    }
    try? data.write(to: snapshotURL, options: [.atomic])
  }

  static func appendEvent(_ event: PendingEvent) {
    guard let eventsURL else {
      return
    }
    var events: [PendingEvent] = []
    if let data = try? Data(contentsOf: eventsURL),
       let decoded = try? JSONDecoder().decode([PendingEvent].self, from: data) {
      events = decoded
    }
    events.append(event)
    if let data = try? JSONEncoder().encode(events) {
      try? data.write(to: eventsURL, options: [.atomic])
    }
  }

  static func slot(from snapshot: WidgetSnapshotFile, slotId: String) -> CounterSnapshot {
    snapshot.slots.first(where: { $0.slotId == slotId }) ?? defaultSlot(slotId: slotId)
  }

  static func record(slotId: String, result: String) {
    var snapshot = loadSnapshot()
    guard let index = snapshot.slots.firstIndex(where: { $0.slotId == slotId }) else {
      return
    }
    var slot = snapshot.slots[index]
    guard slot.isAvailable, let counterId = slot.counterId else {
      return
    }

    let now = ISO8601DateFormatter().string(from: Date())
    let event = PendingEvent(
      id: "widget_\(UUID().uuidString)",
      slotId: slotId,
      counterId: counterId,
      result: result,
      createdAt: now
    )
    if result == "win" {
      slot.wins += 1
    } else {
      slot.losses += 1
    }
    slot.total = slot.wins + slot.losses
    slot.winRateLabel = formatWinRate(wins: slot.wins, losses: slot.losses)
    slot.pendingEvents = (slot.pendingEvents ?? []) + [event]
    snapshot.slots[index] = slot
    snapshot.updatedAt = now

    appendEvent(event)
    saveSnapshot(snapshot)
  }
}

enum WidgetSlot: String, CaseIterable, AppEnum {
  case slot1
  case slot2
  case slot3

  static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "ウィジェット枠")
  static var caseDisplayRepresentations: [WidgetSlot: DisplayRepresentation] = [
    .slot1: DisplayRepresentation(title: "枠1"),
    .slot2: DisplayRepresentation(title: "枠2"),
    .slot3: DisplayRepresentation(title: "枠3")
  ]
}

struct WinRateWidgetConfiguration: WidgetConfigurationIntent {
  static var title: LocalizedStringResource = "表示するカウンター"
  static var description = IntentDescription("アプリ内で割り当てたウィジェット枠を選びます。")

  @Parameter(title: "ウィジェット枠", default: .slot1)
  var slot: WidgetSlot
}

struct RecordMatchIntent: AppIntent {
  static var title: LocalizedStringResource = "勝敗を記録"
  static var isDiscoverable = false

  @Parameter(title: "ウィジェット枠")
  var slotId: String

  @Parameter(title: "結果")
  var result: String

  init() {}

  init(slotId: String, result: String) {
    self.slotId = slotId
    self.result = result
  }

  func perform() async throws -> some IntentResult {
    SharedStore.record(slotId: slotId, result: result)
    WidgetCenter.shared.reloadAllTimelines()
    return .result()
  }
}

struct WinRateEntry: TimelineEntry {
  let date: Date
  let configuration: WinRateWidgetConfiguration
  let snapshot: WidgetSnapshotFile
}

struct WinRateProvider: AppIntentTimelineProvider {
  func placeholder(in context: Context) -> WinRateEntry {
    WinRateEntry(date: Date(), configuration: WinRateWidgetConfiguration(), snapshot: SharedStore.loadSnapshot())
  }

  func snapshot(for configuration: WinRateWidgetConfiguration, in context: Context) async -> WinRateEntry {
    WinRateEntry(date: Date(), configuration: configuration, snapshot: SharedStore.loadSnapshot())
  }

  func timeline(for configuration: WinRateWidgetConfiguration, in context: Context) async -> Timeline<WinRateEntry> {
    Timeline(
      entries: [WinRateEntry(date: Date(), configuration: configuration, snapshot: SharedStore.loadSnapshot())],
      policy: .after(Date().addingTimeInterval(60 * 15))
    )
  }
}

struct WinRateWidgetView: View {
  @Environment(\.widgetFamily) private var family
  var entry: WinRateEntry

  private var slot: CounterSnapshot {
    SharedStore.slot(from: entry.snapshot, slotId: entry.configuration.slot.rawValue)
  }

  var body: some View {
    switch family {
    case .systemMedium:
      mediumView
    case .accessoryRectangular:
      lockView
    default:
      smallView
    }
  }

  private var smallView: some View {
    VStack(alignment: .leading, spacing: 8) {
      Text(slot.label)
        .font(.caption2.weight(.semibold))
        .foregroundStyle(.secondary)
      Text(slot.name)
        .font(.headline.weight(.semibold))
        .lineLimit(1)
      Text(slot.winRateLabel)
        .font(.system(size: 34, weight: .black, design: .rounded))
        .monospacedDigit()
        .minimumScaleFactor(0.75)
      Text("\(slot.wins)勝 / \(slot.losses)負")
        .font(.caption.weight(.medium))
        .foregroundStyle(.secondary)
      Spacer(minLength: 0)
      HStack(spacing: 8) {
        recordButton(title: "勝", result: "win", color: .green)
        recordButton(title: "負", result: "loss", color: .red)
      }
    }
    .padding(14)
    .containerBackground(Color(.systemBackground), for: .widget)
  }

  private var mediumView: some View {
    HStack(spacing: 16) {
      VStack(alignment: .leading, spacing: 8) {
        Text(slot.label)
          .font(.caption.weight(.semibold))
          .foregroundStyle(.secondary)
        Text(slot.name)
          .font(.headline.weight(.semibold))
          .lineLimit(1)
        Text(slot.winRateLabel)
          .font(.system(size: 42, weight: .black, design: .rounded))
          .monospacedDigit()
          .minimumScaleFactor(0.7)
        Text("\(slot.wins)勝 / \(slot.losses)負 / \(slot.total)戦")
          .font(.caption.weight(.medium))
          .foregroundStyle(.secondary)
      }
      Spacer()
      VStack(spacing: 10) {
        recordButton(title: "勝ち", result: "win", color: .green)
        recordButton(title: "負け", result: "loss", color: .red)
      }
      .frame(width: 96)
    }
    .padding(16)
    .containerBackground(Color(.systemBackground), for: .widget)
  }

  private var lockView: some View {
    HStack(spacing: 6) {
      VStack(alignment: .leading, spacing: 1) {
        Text(slot.name)
          .font(.caption2.weight(.semibold))
          .lineLimit(1)
        Text(slot.winRateLabel)
          .font(.system(size: 19, weight: .black, design: .rounded))
          .monospacedDigit()
          .minimumScaleFactor(0.75)
      }
      Spacer(minLength: 4)
      recordButton(title: "勝", result: "win", color: .green)
      recordButton(title: "負", result: "loss", color: .red)
    }
  }

  private func recordButton(title: String, result: String, color: Color) -> some View {
    Button(intent: RecordMatchIntent(slotId: slot.slotId, result: result)) {
      Text(title)
        .font(.caption.weight(.bold))
        .frame(maxWidth: .infinity, minHeight: 28)
    }
    .buttonStyle(.borderedProminent)
    .tint(slot.isAvailable ? color : .gray)
    .disabled(!slot.isAvailable)
  }
}

struct WinRateWidget: Widget {
  let kind = "WinRateWidget"

  var body: some WidgetConfiguration {
    AppIntentConfiguration(kind: kind, intent: WinRateWidgetConfiguration.self, provider: WinRateProvider()) { entry in
      WinRateWidgetView(entry: entry)
    }
    .configurationDisplayName("勝率カウンター")
    .description("勝ち負けをすぐに記録します。")
    .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular])
  }
}

@main
struct WinRateWidgetBundle: WidgetBundle {
  var body: some Widget {
    WinRateWidget()
  }
}

private let defaultSlots: [CounterSnapshot] = [
  defaultSlot(slotId: "slot1"),
  defaultSlot(slotId: "slot2"),
  defaultSlot(slotId: "slot3")
]

private func defaultSlot(slotId: String) -> CounterSnapshot {
  let label: String
  switch slotId {
  case "slot2":
    label = "枠2"
  case "slot3":
    label = "枠3"
  default:
    label = "枠1"
  }
  return CounterSnapshot(
    slotId: slotId,
    label: label,
    counterId: nil,
    name: "カウンターなし",
    wins: 0,
    losses: 0,
    total: 0,
    winRateLabel: "--%",
    isAvailable: false,
    pendingEvents: []
  )
}

private func formatWinRate(wins: Int, losses: Int) -> String {
  let total = wins + losses
  guard total > 0 else {
    return "--%"
  }
  let value = Double(wins) / Double(total) * 100
  return String(format: "%.1f%%", value)
}
