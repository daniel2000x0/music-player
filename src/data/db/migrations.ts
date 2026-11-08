import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Migraciones incrementales de SQLite.
 *
 * LÓGICA: `PRAGMA user_version` marca la versión aplicada. Cada bloque sube
 * la versión una unidad. Nunca se borran datos del usuario en una migración.
 */

export const DATABASE_VERSION = 1;

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

export async function migrateDatabase(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let currentVersion = row?.user_version ?? 0;

  if (currentVersion >= DATABASE_VERSION) {
    return;
  }

  if (currentVersion < 1) {
    await db.execAsync(V1);
    currentVersion = 1;
  }

  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}
