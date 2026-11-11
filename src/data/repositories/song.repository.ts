import { getDatabase } from '@/data/db/database';
import { detectAudiobookSongIds } from '@/domain/library/audiobooks';
import type { Song, ScannedSong } from '@/types/song';

type SongRow = {
  id: number;
  media_id: string;
  uri: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  artwork_uri: string | null;
  added_at: number;
  is_available: number;
  is_audiobook: number;
  play_count: number;
  last_played_at: number | null;
};

const SELECT_SONGS = `
  SELECT s.id, s.media_id, s.uri, s.title,
         ar.name AS artist, al.title AS album,
         s.duration, s.artwork_uri, s.added_at,
         s.is_available, s.is_audiobook, s.play_count, s.last_played_at
  FROM songs s
  JOIN artists ar ON ar.id = s.artist_id
  JOIN albums al ON al.id = s.album_id
`;

function mapSong(row: SongRow): Song {
  return {
    id: row.id,
    mediaId: row.media_id,
    uri: row.uri,
    title: row.title,
    artist: row.artist,
    album: row.album,
    duration: row.duration,
    artwork: row.artwork_uri,
    addedAt: row.added_at,
    isAvailable: row.is_available === 1,
    isAudiobook: row.is_audiobook === 1,
    playCount: row.play_count,
    lastPlayedAt: row.last_played_at,
  };
}

/**
 * Devuelve el ID del artista (creándolo si no existe), memorizando por escaneo.
 *
 * RENDIMIENTO: una biblioteca tiene decenas de artistas, no uno por canción;
 * el caché evita repetir el SELECT (un round-trip al bridge nativo) por cada
 * canción del mismo artista.
 */
async function getOrCreateArtistId(
  name: string,
  now: number,
  cache: Map<string, number>
): Promise<number> {
  const cachedId = cache.get(name);
  if (cachedId !== undefined) {
    return cachedId;
  }
  const db = await getDatabase();
  const existing = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM artists WHERE name = ?',
    name
  );
  if (existing) {
    cache.set(name, existing.id);
    return existing.id;
  }
  const result = await db.runAsync(
    'INSERT INTO artists (name, created_at) VALUES (?, ?)',
    name,
    now
  );
  cache.set(name, result.lastInsertRowId);
  return result.lastInsertRowId;
}

/** Entrada del caché de álbumes por escaneo. */
type AlbumCacheEntry = {
  id: number;
  /** Si el álbum ya tiene portada en BD (o la recibió en este escaneo). */
  hasArtwork: boolean;
};

/**
 * Devuelve el ID del álbum (creándolo si no existe), memorizando por escaneo.
 *
 * RENDIMIENTO: mismo patrón que `getOrCreateArtistId`. El caché además
 * recuerda si el álbum ya tiene portada, de modo que el backfill de arte
 * (completar álbumes preexistentes sin portada) corre a lo sumo una vez por
 * álbum en todo el escaneo.
 */
async function getOrCreateAlbumId(
  title: string,
  artistId: number,
  artwork: string | null,
  now: number,
  cache: Map<string, AlbumCacheEntry>
): Promise<number> {
  const key = `${artistId}\u0000${title}`;
  const cached = cache.get(key);
  if (cached) {
    // Un re-escaneo que encuentra arte completa álbumes creados sin portada.
    if (artwork && !cached.hasArtwork) {
      const db = await getDatabase();
      await db.runAsync('UPDATE albums SET artwork_uri = ? WHERE id = ?', artwork, cached.id);
      cached.hasArtwork = true;
    }
    return cached.id;
  }
  const db = await getDatabase();
  const existing = await db.getFirstAsync<{ id: number; artwork_uri: string | null }>(
    'SELECT id, artwork_uri FROM albums WHERE title = ? AND artist_id = ?',
    title,
    artistId
  );
  if (existing) {
    // Un re-escaneo que encuentra arte completa álbumes creados sin portada.
    if (artwork && !existing.artwork_uri) {
      await db.runAsync('UPDATE albums SET artwork_uri = ? WHERE id = ?', artwork, existing.id);
    }
    cache.set(key, {
      id: existing.id,
      hasArtwork: Boolean(existing.artwork_uri) || Boolean(artwork),
    });
    return existing.id;
  }
  const result = await db.runAsync(
    'INSERT INTO albums (title, artist_id, artwork_uri, created_at) VALUES (?, ?, ?, ?)',
    title,
    artistId,
    artwork,
    now
  );
  cache.set(key, { id: result.lastInsertRowId, hasArtwork: Boolean(artwork) });
  return result.lastInsertRowId;
}

export const songRepository = {
  /** Sincroniza el escaneo con SQLite sin duplicar canciones. */
  async upsertScannedSongs(scanned: ScannedSong[]): Promise<void> {
    const db = await getDatabase();
    const now = Date.now();

    await db.withTransactionAsync(async () => {
      await db.runAsync('UPDATE songs SET is_available = 0');
      // Cachés de IDs por escaneo: los artistas/álbumes se repiten entre
      // canciones, así que se resuelven una sola vez (ver helpers arriba).
      const artistCache = new Map<string, number>();
      const albumCache = new Map<string, AlbumCacheEntry>();

      for (const item of scanned) {
        const artistId = await getOrCreateArtistId(item.artist, now, artistCache);
        const albumId = await getOrCreateAlbumId(
          item.album,
          artistId,
          item.artwork,
          now,
          albumCache
        );

        await db.runAsync(
          `INSERT INTO songs
            (media_id, uri, title, artist_id, album_id, duration, artwork_uri,
             added_at, last_seen_at, is_available)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
           ON CONFLICT(media_id) DO UPDATE SET
             uri = excluded.uri,
             title = excluded.title,
             artist_id = excluded.artist_id,
             album_id = excluded.album_id,
             duration = excluded.duration,
             artwork_uri = excluded.artwork_uri,
             last_seen_at = excluded.last_seen_at,
             is_available = 1`,
          item.mediaId,
          item.uri,
          item.title,
          artistId,
          albumId,
          item.duration,
          item.artwork,
          now,
          now
        );
      }
    });
  },

  async getAll(includeUnavailable = false): Promise<Song[]> {
    const db = await getDatabase();
    const where = includeUnavailable ? '' : 'WHERE s.is_available = 1';
    const rows = await db.getAllAsync<SongRow>(
      `${SELECT_SONGS} ${where} ORDER BY s.title COLLATE NOCASE ASC`
    );
    return rows.map(mapSong);
  },

  async getById(id: number): Promise<Song | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<SongRow>(`${SELECT_SONGS} WHERE s.id = ?`, id);
    return row ? mapSong(row) : null;
  },

  async getByIds(ids: number[]): Promise<Song[]> {
    if (ids.length === 0) {
      return [];
    }
    const db = await getDatabase();
    const placeholders = ids.map(() => '?').join(',');
    const rows = await db.getAllAsync<SongRow>(
      `${SELECT_SONGS} WHERE s.id IN (${placeholders})`,
      ...ids
    );
    const map = new Map(rows.map((row) => [row.id, mapSong(row)]));
    return ids.map((id) => map.get(id)).filter((song): song is Song => song !== undefined);
  },

  async incrementPlayCount(songId: number, playedAt: number): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `UPDATE songs
       SET play_count = play_count + 1, last_played_at = ?
       WHERE id = ?`,
      playedAt,
      songId
    );
  },

  async resetPlayStats(): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('UPDATE songs SET play_count = 0, last_played_at = NULL');
  },

  /**
   * Reclasifica audiolibros tras un escaneo: la heurística solo toca
   * canciones sin decisión manual del usuario (`audiobook_manual = 0`),
   * de modo que "agregar/remover como audiolibro" persiste entre escaneos.
   */
  async reclassifyAudiobooks(): Promise<void> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{ id: number; album: string; artist: string; duration: number }>(
      `SELECT s.id, al.title AS album, ar.name AS artist, s.duration
       FROM songs s
       JOIN albums al ON al.id = s.album_id
       JOIN artists ar ON ar.id = s.artist_id
       WHERE s.is_available = 1`
    );
    const detected = detectAudiobookSongIds(rows);
    await db.runAsync('UPDATE songs SET is_audiobook = 0 WHERE audiobook_manual = 0');
    if (detected.size > 0) {
      const placeholders = [...detected].map(() => '?').join(',');
      await db.runAsync(
        `UPDATE songs SET is_audiobook = 1
         WHERE audiobook_manual = 0 AND id IN (${placeholders})`,
        ...detected
      );
    }
  },

  /** Marca canciones como audiolibro (o las devuelve a Canciones). */
  async setAudiobook(songIds: number[], isAudiobook: boolean): Promise<void> {
    if (songIds.length === 0) {
      return;
    }
    const db = await getDatabase();
    const placeholders = songIds.map(() => '?').join(',');
    await db.runAsync(
      `UPDATE songs SET is_audiobook = ?, audiobook_manual = 1 WHERE id IN (${placeholders})`,
      isAudiobook ? 1 : 0,
      ...songIds
    );
  },
};
