import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Migraciones incrementales de SQLite.
 *
 * LÓGICA: cada paso se valida contra el esquema real de la BD (ver
 * `migrateDatabase`); `PRAGMA user_version` queda solo como referencia.
 * Nunca se borran datos del usuario en una migración.
 */

export const DATABASE_VERSION = 10;

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

/**
 * V6: sesión de reproducción persistida (`A-01`). Una sola fila (`id = 1`):
 * la app reproduce una cosa a la vez. El payload es el JSON de
 * `PlaybackSession` (ids de canción, no canciones completas).
 */
const V6 = `
CREATE TABLE IF NOT EXISTS playback_sessions (
  id         INTEGER PRIMARY KEY CHECK (id = 1),
  payload    TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
`;

/**
 * V8: gestión de la biblioteca (`FASE 5.2`).
 *
 * LÓGICA: `ignored_media` recuerda los `media_id` que el usuario quitó de la
 * biblioteca sin borrar el archivo, para que el escaneo no los vuelva a
 * añadir. La columna `songs.metadata_manual` marca las pistas con correcciones
 * de título/artista/álbum hechas por el usuario, de modo que un reescaneo no
 * las pise con las etiquetas del archivo.
 */
const V8 = `
CREATE TABLE IF NOT EXISTS ignored_media (
  media_id   TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL
);
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

  // V6: sesión de reproducción persistida (`A-01`).
  if (!(await tableExists('playback_sessions'))) {
    await db.execAsync(V6);
  }

  // V8: pistas quitadas de la biblioteca sin borrar el archivo (`FASE 5.2`).
  if (!(await tableExists('ignored_media'))) {
    await db.execAsync(V8);
  }

  if (!(await columnExists('songs', 'is_audiobook'))) {
    await db.runAsync('ALTER TABLE songs ADD COLUMN is_audiobook INTEGER NOT NULL DEFAULT 0');
  }
  if (!(await columnExists('songs', 'audiobook_manual'))) {
    await db.runAsync('ALTER TABLE songs ADD COLUMN audiobook_manual INTEGER NOT NULL DEFAULT 0');
  }
  if (!(await columnExists('songs', 'track_number'))) {
    await db.runAsync('ALTER TABLE songs ADD COLUMN track_number INTEGER');
  }
  if (!(await columnExists('songs', 'folder_name'))) {
    await db.runAsync('ALTER TABLE songs ADD COLUMN folder_name TEXT');
  }
  /**
   * V5: fecha de modificación del asset para el escaneo incremental (`M-04`).
   * `NULL` en filas anteriores a la migración; el primer diff las relee una
   * vez y a partir de ahí solo cambian las pistas realmente modificadas.
   */
  if (!(await columnExists('songs', 'modification_time'))) {
    await db.runAsync('ALTER TABLE songs ADD COLUMN modification_time INTEGER');
  }
  /**
   * V7: fecha del último intento de extraer la portada de una pista (`FASE 5.1`).
   *
   * LÓGICA: la búsqueda de carátulas ausentes (formatos FLAC y arte de carpeta)
   * debe correr una sola vez por pista. Las filas anteriores a esta migración
   * quedan con `NULL` y son las únicas candidatas del primer barrido; a partir
   * de ahí cada intento (con o sin portada) sella la fecha y no se repite.
   */
  if (!(await columnExists('songs', 'artwork_checked_at'))) {
    await db.runAsync('ALTER TABLE songs ADD COLUMN artwork_checked_at INTEGER');
  }
  /**
   * V8: corrección manual de metadatos (`FASE 5.2`).
   *
   * LÓGICA: `1` cuando el usuario editó el título, el artista o el álbum de la
   * pista. El upsert del escaneo respeta esas columnas y no las reescribe con
   * las etiquetas del archivo.
   */
  if (!(await columnExists('songs', 'metadata_manual'))) {
    await db.runAsync('ALTER TABLE songs ADD COLUMN metadata_manual INTEGER NOT NULL DEFAULT 0');
  }
  /**
   * V9: formato de archivo para la etiqueta de calidad.
   *
   * LÓGICA: se guarda la extensión normalizada (`flac`, `mp3`, `m4a`...). Es
   * información derivada de la URI/nombre de archivo, así que `NULL` en filas
   * antiguas se rellena en el siguiente escaneo o con un backfill barato.
   */
  if (!(await columnExists('songs', 'file_format'))) {
    await db.runAsync('ALTER TABLE songs ADD COLUMN file_format TEXT');
  }
  /**
   * V10: metadatos técnicos de audio para la etiqueta de calidad.
   *
   * LÓGICA: `bit_depth`, `sample_rate` y `bitrate` permiten mostrar formatos
   * como "FLAC 16/44.1 kHz · 1411 kbps". Son opcionales; si no se conocen quedan
   * en NULL y la UI degrada con gracia.
   */
  if (!(await columnExists('songs', 'bit_depth'))) {
    await db.runAsync('ALTER TABLE songs ADD COLUMN bit_depth INTEGER');
  }
  if (!(await columnExists('songs', 'sample_rate'))) {
    await db.runAsync('ALTER TABLE songs ADD COLUMN sample_rate INTEGER');
  }
  if (!(await columnExists('songs', 'bitrate'))) {
    await db.runAsync('ALTER TABLE songs ADD COLUMN bitrate INTEGER');
  }
  await db.execAsync('CREATE INDEX IF NOT EXISTS idx_songs_audiobook ON songs(is_audiobook)');
  await db.execAsync(
    'CREATE INDEX IF NOT EXISTS idx_songs_modification ON songs(modification_time)'
  );
  await db.execAsync('CREATE INDEX IF NOT EXISTS idx_songs_available ON songs(is_available)');

  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}
