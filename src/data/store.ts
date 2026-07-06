import * as SQLite from 'expo-sqlite';

import { createId } from '../lib/format';
import type {
  CounterSummary,
  MatchRecord,
  MatchResult,
  WidgetSlot,
  WidgetSlotId
} from '../types';

type CounterRow = {
  id: string;
  name: string;
  photoUri: string | null;
  isArchived: number;
  createdAt: string;
  updatedAt: string;
  lastRecordedAt: string | null;
  wins: number | null;
  losses: number | null;
};

type RecordRow = {
  id: string;
  counterId: string;
  counterName: string;
  result: MatchResult;
  createdAt: string;
};

type SlotRow = {
  id: WidgetSlotId;
  label: string;
  counterId: string | null;
};

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

const slotSeeds: WidgetSlot[] = [
  { id: 'slot1', label: '枠1', counterId: null },
  { id: 'slot2', label: '枠2', counterId: null },
  { id: 'slot3', label: '枠3', counterId: null }
];

async function getDb() {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('win-track.db');
  }
  return dbPromise;
}

export async function initializeStore() {
  const db = await getDb();
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS counters (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      photoUri TEXT,
      isArchived INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      lastRecordedAt TEXT
    );
    CREATE TABLE IF NOT EXISTS match_records (
      id TEXT PRIMARY KEY NOT NULL,
      counterId TEXT NOT NULL,
      result TEXT NOT NULL CHECK(result IN ('win', 'loss')),
      createdAt TEXT NOT NULL,
      FOREIGN KEY(counterId) REFERENCES counters(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_records_counter ON match_records(counterId);
    CREATE INDEX IF NOT EXISTS idx_records_created ON match_records(createdAt DESC);
    CREATE TABLE IF NOT EXISTS widget_slots (
      id TEXT PRIMARY KEY NOT NULL,
      label TEXT NOT NULL,
      counterId TEXT,
      FOREIGN KEY(counterId) REFERENCES counters(id) ON DELETE SET NULL
    );
  `);

  for (const slot of slotSeeds) {
    await db.runAsync(
      'INSERT OR IGNORE INTO widget_slots (id, label, counterId) VALUES (?, ?, ?)',
      slot.id,
      slot.label,
      slot.counterId
    );
  }
}

export async function listCounters(options?: { includeArchived?: boolean }) {
  const db = await getDb();
  const where = options?.includeArchived ? '' : 'WHERE c.isArchived = 0';
  const rows = await db.getAllAsync<CounterRow>(
    `
    SELECT
      c.id,
      c.name,
      c.photoUri,
      c.isArchived,
      c.createdAt,
      c.updatedAt,
      c.lastRecordedAt,
      SUM(CASE WHEN r.result = 'win' THEN 1 ELSE 0 END) AS wins,
      SUM(CASE WHEN r.result = 'loss' THEN 1 ELSE 0 END) AS losses
    FROM counters c
    LEFT JOIN match_records r ON r.counterId = c.id
    ${where}
    GROUP BY c.id
    ORDER BY
      CASE WHEN c.lastRecordedAt IS NULL THEN 1 ELSE 0 END,
      c.lastRecordedAt DESC,
      c.createdAt DESC
    `
  );
  return rows.map(mapCounterRow);
}

export async function createCounter(name: string, photoUri: string | null) {
  const db = await getDb();
  const now = new Date().toISOString();
  const id = createId('counter');
  await db.runAsync(
    `INSERT INTO counters (id, name, photoUri, isArchived, createdAt, updatedAt, lastRecordedAt)
     VALUES (?, ?, ?, 0, ?, ?, NULL)`,
    id,
    name.trim(),
    photoUri,
    now,
    now
  );
  return id;
}

export async function updateCounter(id: string, name: string, photoUri: string | null) {
  const db = await getDb();
  await db.runAsync(
    'UPDATE counters SET name = ?, photoUri = ?, updatedAt = ? WHERE id = ?',
    name.trim(),
    photoUri,
    new Date().toISOString(),
    id
  );
}

export async function archiveCounter(id: string) {
  const db = await getDb();
  await db.runAsync(
    'UPDATE counters SET isArchived = 1, updatedAt = ? WHERE id = ?',
    new Date().toISOString(),
    id
  );
  await db.runAsync('UPDATE widget_slots SET counterId = NULL WHERE counterId = ?', id);
}

export async function restoreCounter(id: string) {
  const db = await getDb();
  await db.runAsync(
    'UPDATE counters SET isArchived = 0, updatedAt = ? WHERE id = ?',
    new Date().toISOString(),
    id
  );
}

export async function deleteCounterPermanently(id: string) {
  const db = await getDb();
  await db.runAsync('DELETE FROM match_records WHERE counterId = ?', id);
  await db.runAsync('UPDATE widget_slots SET counterId = NULL WHERE counterId = ?', id);
  await db.runAsync('DELETE FROM counters WHERE id = ?', id);
}

export async function recordMatch(counterId: string, result: MatchResult, createdAt = new Date().toISOString()) {
  await insertRecord(createId('record'), counterId, result, createdAt);
}

export async function recordWidgetEvent(
  eventId: string,
  counterId: string,
  result: MatchResult,
  createdAt: string
) {
  await insertRecord(eventId, counterId, result, createdAt);
}

async function insertRecord(id: string, counterId: string, result: MatchResult, createdAt: string) {
  const db = await getDb();
  const counter = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM counters WHERE id = ? AND isArchived = 0',
    counterId
  );
  if (!counter) {
    return;
  }
  await db.runAsync(
    'INSERT OR IGNORE INTO match_records (id, counterId, result, createdAt) VALUES (?, ?, ?, ?)',
    id,
    counterId,
    result,
    createdAt
  );
  await updateCounterLastRecordedAt(counterId);
}

export async function deleteRecord(recordId: string) {
  const db = await getDb();
  const row = await db.getFirstAsync<{ counterId: string }>(
    'SELECT counterId FROM match_records WHERE id = ?',
    recordId
  );
  if (!row) {
    return;
  }
  await db.runAsync('DELETE FROM match_records WHERE id = ?', recordId);
  await updateCounterLastRecordedAt(row.counterId);
}

export async function restoreRecord(record: MatchRecord) {
  await insertRecord(record.id, record.counterId, record.result, record.createdAt);
}

export async function undoLastRecord(counterId: string) {
  const db = await getDb();
  const row = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM match_records WHERE counterId = ? ORDER BY createdAt DESC LIMIT 1',
    counterId
  );
  if (!row) {
    return false;
  }
  await db.runAsync('DELETE FROM match_records WHERE id = ?', row.id);
  await updateCounterLastRecordedAt(counterId);
  return true;
}

export async function listHistory(filterCounterId?: string | null) {
  const db = await getDb();
  const baseQuery = `
    SELECT r.id, r.counterId, c.name AS counterName, r.result, r.createdAt
    FROM match_records r
    INNER JOIN counters c ON c.id = r.counterId
    WHERE c.isArchived = 0
  `;
  const rows = filterCounterId
    ? await db.getAllAsync<RecordRow>(
        `${baseQuery} AND c.id = $counterId ORDER BY r.createdAt DESC LIMIT 500`,
        { $counterId: filterCounterId }
      )
    : await db.getAllAsync<RecordRow>(`${baseQuery} ORDER BY r.createdAt DESC LIMIT 500`);
  return rows.map((row): MatchRecord => ({ ...row }));
}

export async function listWidgetSlots() {
  const db = await getDb();
  return db.getAllAsync<SlotRow>('SELECT id, label, counterId FROM widget_slots ORDER BY id ASC');
}

export async function assignWidgetSlot(slotId: WidgetSlotId, counterId: string | null) {
  const db = await getDb();
  await db.runAsync('UPDATE widget_slots SET counterId = ? WHERE id = ?', counterId, slotId);
}

export async function resetAllData() {
  const db = await getDb();
  await db.runAsync('DELETE FROM match_records');
  await db.runAsync('DELETE FROM counters');
  await db.runAsync('UPDATE widget_slots SET counterId = NULL');
}

async function updateCounterLastRecordedAt(counterId: string) {
  const db = await getDb();
  const row = await db.getFirstAsync<{ createdAt: string | null }>(
    'SELECT createdAt FROM match_records WHERE counterId = ? ORDER BY createdAt DESC LIMIT 1',
    counterId
  );
  await db.runAsync(
    'UPDATE counters SET lastRecordedAt = ?, updatedAt = ? WHERE id = ?',
    row?.createdAt ?? null,
    new Date().toISOString(),
    counterId
  );
}

function mapCounterRow(row: CounterRow): CounterSummary {
  const wins = row.wins ?? 0;
  const losses = row.losses ?? 0;
  return {
    id: row.id,
    name: row.name,
    photoUri: row.photoUri,
    isArchived: row.isArchived === 1,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lastRecordedAt: row.lastRecordedAt,
    wins,
    losses,
    total: wins + losses
  };
}
