import type { SQLiteDatabase } from 'expo-sqlite';

import { DATABASE_VERSION, migrateDatabase } from '@/data/db/migrations';

/**
 * Pruebas de la migración v6 con un SQLite falso.
 *
 * LÓGICA: se controla el esquema visible (`sqlite_master` y `PRAGMA
 * table_info`) para verificar que la columna y los índices del escaneo
 * incremental se crean una sola vez y que la migración es idempotente.
 */
const mockExecLog: string[] = [];
const mockRunLog: string[] = [];
const mockTables = new Set<string>();
const mockColumns = new Set<string>();

const mockDb = {
  execAsync: jest.fn(async (sql: string) => {
    mockExecLog.push(sql);
  }),
  runAsync: jest.fn(async (sql: string) => {
    mockRunLog.push(sql);
  }),
  getFirstAsync: jest.fn(async (sql: string, ...params: unknown[]) => {
    if (sql.includes('sqlite_master')) {
      const name = String(params[0]);
      return mockTables.has(name) ? { name } : null;
    }
    return null;
  }),
  getAllAsync: jest.fn(async (sql: string) => {
    const match = /PRAGMA table_info\((\w+)\)/.exec(sql);
    if (match?.[1] === 'songs') {
      return [...mockColumns].map((name) => ({ name }));
    }
    return [];
  }),
};

const db = mockDb as unknown as SQLiteDatabase;

const SONG_COLUMNS = [
  'is_audiobook',
  'audiobook_manual',
  'track_number',
  'folder_name',
  'modification_time',
];

beforeEach(() => {
  jest.clearAllMocks();
  mockExecLog.length = 0;
  mockRunLog.length = 0;
  mockTables.clear();
  mockColumns.clear();
});

describe('migrateDatabase: base nueva', () => {
  it('crea las tablas base y la columna del escaneo incremental', async () => {
    await migrateDatabase(db);

    expect(mockExecLog.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS songs'))).toBe(
      true
    );
    expect(mockExecLog.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS error_logs'))).toBe(
      true
    );
    expect(
      mockExecLog.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS playback_sessions'))
    ).toBe(true);
    expect(mockRunLog).toContain(
      'ALTER TABLE songs ADD COLUMN modification_time INTEGER'
    );
  });

  it('crea los índices de fecha y disponibilidad', async () => {
    await migrateDatabase(db);

    expect(
      mockExecLog.some((sql) => sql.includes('idx_songs_modification'))
    ).toBe(true);
    expect(mockExecLog.some((sql) => sql.includes('idx_songs_available'))).toBe(true);
    expect(
      mockRunLog.every((sql) => !sql.includes('modification_time INTEGER NOT NULL'))
    ).toBe(true);
  });

  it('deja PRAGMA user_version en la versión actual', async () => {
    await migrateDatabase(db);

    expect(DATABASE_VERSION).toBe(6);
    expect(mockExecLog).toContain(`PRAGMA user_version = ${DATABASE_VERSION}`);
  });
});

describe('migrateDatabase: esquema ya migrado', () => {
  it('no repite ALTER cuando la columna ya existe', async () => {
    mockTables.add('songs');
    mockTables.add('error_logs');
    mockTables.add('playback_sessions');
    for (const column of SONG_COLUMNS) {
      mockColumns.add(column);
    }

    await migrateDatabase(db);

    expect(mockRunLog).toHaveLength(0);
    expect(mockExecLog).toContain(`PRAGMA user_version = ${DATABASE_VERSION}`);
  });

  it('añade solo la columna faltante en una BD de la versión anterior', async () => {
    mockTables.add('songs');
    mockTables.add('error_logs');
    for (const column of SONG_COLUMNS.filter((name) => name !== 'modification_time')) {
      mockColumns.add(column);
    }

    await migrateDatabase(db);

    expect(mockRunLog).toEqual([
      'ALTER TABLE songs ADD COLUMN modification_time INTEGER',
    ]);
  });
});
