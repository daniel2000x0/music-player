import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Migraciones incrementales de SQLite.
 *
 * LÓGICA: cada paso se valida contra el esquema real de la BD (ver
 * `migrateDatabase`); `PRAGMA user_version` queda solo como referencia.
 * Nunca se borran datos del usuario en una migración.
 */

export const DATABASE_VERSION = 3;

const V1 = `
CREATE TABLE IF NOT EXISTS artists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS albums (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  artist_id INTEGER NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  artwork_uri TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE(title, artist_id)
);

CREATE TABLE IF NOT EXISTS songs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  media_id TEXT NOT NULL UNIQUE,
  uri TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  artist_id INTEGER NOT NULL REFERENCES artists(id),
  album_id INTEGER NOT NULL REFERENCES albums(id),
  duration REAL NOT NULL DEFAULT 0,
  artwork_uri TEXT,
  added_at INTEGER NOT NULL,
  last_seen_at INTEGER,
  is_available INTEGER NOT NULL DEFAULT 1,
  play_count INTEGER NOT NULL DEFAULT 0,
  last_played_at INTEGER
);

CREATE TABLE IF NOT EXISTS favorites (
  song_id INTEGER PRIMARY KEY REFERENCES songs(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS playlists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  is_auto INTEGER NOT NULL DEFAULT 0,
  auto_key TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS playlist_songs (
  playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  song_id INTEGER NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  added_at INTEGER NOT NULL,
  PRIMARY KEY(playlist_id, song_id)
);

CREATE TABLE IF NOT EXISTS playback_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  song_id INTEGER NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  played_at INTEGER NOT NULL,
  listened_seconds REAL NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_songs_artist ON songs(artist_id);
CREATE INDEX IF NOT EXISTS idx_songs_album ON songs(album_id);
CREATE INDEX IF NOT EXISTS idx_songs_title ON songs(title COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_songs_duration ON songs(duration);
CREATE INDEX IF NOT EXISTS idx_songs_added ON songs(added_at);
CREATE INDEX IF NOT EXISTS idx_songs_play_count ON songs(play_count);
CREATE INDEX IF NOT EXISTS idx_songs_last_played ON songs(last_played_at);
CREATE INDEX IF NOT EXISTS idx_playlist_songs_order ON playlist_songs(playlist_id, position);
CREATE INDEX IF NOT EXISTS idx_history_song ON playback_history(song_id, played_at);
`;

/**
 * V2: registro local de errores y advertencias de la app. Guarda contexto
 * (pantalla/servicio, acción en curso) y deduplica por huella para evitar
 * que un fallo repetido llene la tabla (actualiza contador y fecha).
 */
const V2 = `
CREATE TABLE IF NOT EXISTS error_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  level TEXT NOT NULL CHECK (level IN ('error', 'warning')),
  scope TEXT NOT NULL,
  action TEXT NOT NULL,
  message TEXT NOT NULL,
  fingerprint TEXT NOT NULL UNIQUE,
  occurrences INTEGER NOT NULL DEFAULT 1,
  first_seen_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_error_logs_last_seen ON error_logs(last_seen_at);
CREATE INDEX IF NOT EXISTS idx_error_logs_level ON error_logs(level, last_seen_at);
`;

export async function migrateDatabase(db: SQLiteDatabase): Promise<void> {
  /**
   * Cada paso se decide por el ESQUEMA real (tablas/columnas presentes), no
   * solo por `PRAGMA user_version`: un bundle intermedio puede subir la
   * versión sin haber ejecutado el DDL, y confiar solo en el número dejaría
   * la BD sin columnas para siempre. Así la migración es idempotente y
   * auto-repara ese estado.
   */
  const tableExists = async (name: string): Promise<boolean> => {
    const row = await db.getFirstAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
      name
    );
    return row != null;
  };
  const columnExists = async (table: string, column: string): Promise<boolean> => {
    const columns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
    return columns.some((col) => col.name === column);
  };

  if (!(await tableExists('songs'))) {
    await db.execAsync(V1);
  }

  if (!(await tableExists('error_logs'))) {
    await db.execAsync(V2);
  }

  if (!(await columnExists('songs', 'is_audiobook'))) {
    await db.runAsync('ALTER TABLE songs ADD COLUMN is_audiobook INTEGER NOT NULL DEFAULT 0');
  }
  if (!(await columnExists('songs', 'audiobook_manual'))) {
    await db.runAsync('ALTER TABLE songs ADD COLUMN audiobook_manual INTEGER NOT NULL DEFAULT 0');
  }
  await db.execAsync('CREATE INDEX IF NOT EXISTS idx_songs_audiobook ON songs(is_audiobook)');

  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}
