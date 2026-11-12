import Storage from 'expo-sqlite/kv-store';

import { getDatabase } from '@/data/db/database';

const LEGACY_KEYS = {
  favorites: 'library.favorites',
  playCounts: 'library.playCounts',
  recent: 'library.recent',
  playlists: 'library.playlists',
} as const;

const MIGRATION_KEY = 'legacy_migrated';

/** Forma de los datos guardados por la versión anterior (ids de mediateca). */
type LegacyRecentEntry = { songId: string; playedAt: number };
type LegacyPlaylist = { id: string; name: string; songIds: string[] };

async function readLegacy<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await Storage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Importa una sola vez los datos del antiguo almacén clave-valor a SQLite.
 * Se ejecuta después del primer escaneo para poder resolver ids de mediateca.
 *
 * Devuelve `true` solo si en esta llamada importó datos; así el llamador
 * puede evitar recargar el estado cuando no hubo cambios.
 */
export async function migrateLegacyLibrary(): Promise<boolean> {
  const db = await getDatabase();
  const done = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM app_settings WHERE key = ?',
    MIGRATION_KEY
  );
  if (done) {
    return false;
  }

  const [favorites, playCounts, recent, playlists] = await Promise.all([
    readLegacy<string[]>(LEGACY_KEYS.favorites, []),
    readLegacy<Record<string, number>>(LEGACY_KEYS.playCounts, {}),
    readLegacy<LegacyRecentEntry[]>(LEGACY_KEYS.recent, []),
    readLegacy<LegacyPlaylist[]>(LEGACY_KEYS.playlists, []),
  ]);

  const songs = await db.getAllAsync<{ id: number; media_id: string }>(
    'SELECT id, media_id FROM songs'
  );
  const idByMedia = new Map(songs.map((song) => [song.media_id, song.id]));
  const resolve = (mediaId: string): number | null => idByMedia.get(mediaId) ?? null;

  await db.withTransactionAsync(async () => {
    for (const mediaId of favorites) {
      const songId = resolve(mediaId);
      if (songId) {
        await db.runAsync(
          'INSERT OR IGNORE INTO favorites (song_id, created_at) VALUES (?, ?)',
          songId,
          Date.now()
        );
      }
    }

    for (const [mediaId, count] of Object.entries(playCounts)) {
      const songId = resolve(mediaId);
      if (songId && count > 0) {
        await db.runAsync(
          'UPDATE songs SET play_count = ? WHERE id = ?',
          count,
          songId
        );
      }
    }

    for (const entry of recent) {
      const songId = resolve(entry.songId);
      if (songId) {
        await db.runAsync(
          `INSERT INTO playback_history (song_id, played_at, listened_seconds, completed)
           VALUES (?, ?, 30, 1)`,
          songId,
          entry.playedAt
        );
      }
    }

    for (const playlist of playlists) {
      const now = Date.now();
      const result = await db.runAsync(
        'INSERT INTO playlists (name, is_auto, auto_key, created_at, updated_at) VALUES (?, 0, NULL, ?, ?)',
        playlist.name,
        now,
        now
      );
      let position = 0;
      for (const mediaId of playlist.songIds) {
        const songId = resolve(mediaId);
        if (songId) {
          await db.runAsync(
            `INSERT OR IGNORE INTO playlist_songs (playlist_id, song_id, position, added_at)
             VALUES (?, ?, ?, ?)`,
            result.lastInsertRowId,
            songId,
            position,
            now
          );
          position += 1;
        }
      }
    }

    await db.runAsync(
      'INSERT INTO app_settings (key, value) VALUES (?, ?)',
      MIGRATION_KEY,
      String(Date.now())
    );
  });

  return true;
}
