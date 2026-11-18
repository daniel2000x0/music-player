import { getDatabase } from '@/data/db/database';
import { detectAudiobookSongIds } from '@/domain/library/audiobooks';
import type { StoredTrack } from '@/domain/library/scan-diff';
import type { Song, ScannedSong } from '@/types/song';

type SongRow = {
  id: number;
  media_id: string;
  uri: string;
  title: string;
  artist: string;
  album: string;
  track_number: number | null;
  folder_name: string | null;
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
         s.track_number, s.folder_name,
         s.duration, s.artwork_uri, s.added_at,
         s.is_available, s.is_audiobook, s.play_count, s.last_played_at
  FROM songs s
  JOIN artists ar ON ar.id = s.artist_id
  JOIN albums al ON al.id = s.album_id
`;

/** Pista candidata del barrido de carátulas ausentes (`FASE 5.1`). */
export type ArtworkCandidate = {
  id: number;
  mediaId: string;
  uri: string;
  /** Álbum al que pertenece; agrupa la extracción por disco. */
  albumId: number;
};

function mapSong(row: SongRow): Song {
  return {
    id: row.id,
    mediaId: row.media_id,
    uri: row.uri,
    title: row.title,
    artist: row.artist,
    album: row.album,
    track: row.track_number,
    folder: row.folder_name,
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
 * Límite de parámetros por sentencia preparada.
 *
 * SQLite acepta 999 variables en compilaciones antiguas; con ids de mediática
 * (una variable por fila) se usa 500 para dejar margen a otros parámetros.
 */
const ID_CHUNK_SIZE = 500;

function chunksOf<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let start = 0; start < items.length; start += size) {
    chunks.push(items.slice(start, start + size));
  }
  return chunks;
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
  /**
   * Estado guardado que necesita el diff del escaneo (`M-04`).
   *
   * Incluye las filas no disponibles para distinguir «reapareció» de «nueva»
   * y para no re-marcar ausentes ya podadas.
   */
  async getScanState(): Promise<StoredTrack[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{
      media_id: string;
      modification_time: number | null;
      is_available: number;
    }>('SELECT media_id, modification_time, is_available FROM songs');
    return rows.map((row) => ({
      mediaId: row.media_id,
      modificationTime: row.modification_time,
      isAvailable: row.is_available === 1,
    }));
  },

  /**
   * Upsert transaccional de un lote de pistas escaneadas.
   *
   * LÓGICA: el llamador entrega lotes acotados (ver `PERSIST_BATCH`). Dentro
   * de una sola transacción se resuelven artistas/álbumes con caché y se
   * escriben sentencias de 50 filas: en bibliotecas grandes esto reduce miles
   * de viajes al bridge nativo a decenas.
   *
   * NO resetea `is_available` de toda la tabla: la poda es explícita con
   * `markMissing` y solo con los ids que el diff demostró ausentes.
   */
  async upsertBatch(scanned: ScannedSong[]): Promise<void> {
    if (scanned.length === 0) {
      return;
    }
    const db = await getDatabase();
    const now = Date.now();

    await db.withTransactionAsync(async () => {
      // Cachés por lote: los artistas/álbumes se repiten entre canciones, así
      // que se resuelven una sola vez (ver helpers arriba).
      const artistCache = new Map<string, number>();
      const albumCache = new Map<string, AlbumCacheEntry>();
      const rows: { item: ScannedSong; artistId: number; albumId: number }[] = [];

      for (const item of scanned) {
        const artistId = await getOrCreateArtistId(item.artist, now, artistCache);
        const albumId = await getOrCreateAlbumId(
          item.album,
          artistId,
          item.artwork,
          now,
          albumCache
        );
        rows.push({ item, artistId, albumId });
      }

      // 50 filas × 13 parámetros = 650, por debajo del límite de SQLite.
      const CHUNK_SIZE = 50;
      for (const chunk of chunksOf(rows, CHUNK_SIZE)) {
        const placeholders = chunk.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)').join(',');
        const params = chunk.flatMap(({ item, artistId, albumId }) => [
          item.mediaId,
          item.uri,
          item.title,
          artistId,
          albumId,
          item.track,
          item.folder,
          item.duration,
          item.artwork,
          now,
          now,
          item.modificationTime,
          now,
        ]);
        await db.runAsync(
          `INSERT INTO songs
            (media_id, uri, title, artist_id, album_id, track_number, folder_name,
             duration, artwork_uri, added_at, last_seen_at, modification_time,
             artwork_checked_at, is_available)
           VALUES ${placeholders}
           ON CONFLICT(media_id) DO UPDATE SET
             uri = excluded.uri,
             title = excluded.title,
             artist_id = excluded.artist_id,
             album_id = excluded.album_id,
             track_number = excluded.track_number,
             folder_name = excluded.folder_name,
             duration = excluded.duration,
             artwork_uri = COALESCE(excluded.artwork_uri, artwork_uri),
             last_seen_at = excluded.last_seen_at,
             modification_time = excluded.modification_time,
             artwork_checked_at = excluded.artwork_checked_at,
             is_available = 1`,
          ...params
        );
      }
    });
  },

  /**
   * Poda lógica: marca como no disponibles las pistas que el diff declaró
   * ausentes. No borra filas para conservar favoritos, historial y playlists.
   */
  async markMissing(mediaIds: string[]): Promise<void> {
    if (mediaIds.length === 0) {
      return;
    }
    const db = await getDatabase();
    for (const chunk of chunksOf(mediaIds, ID_CHUNK_SIZE)) {
      const placeholders = chunk.map(() => '?').join(',');
      await db.runAsync(
        `UPDATE songs SET is_available = 0 WHERE media_id IN (${placeholders})`,
        ...chunk
      );
    }
  },

  /**
   * Canciones disponibles sin portada, candidatas al barrido de carátulas
   * (`FASE 5.1`).
   *
   * LÓGICA: con `force` se revisan todas las que no tienen portada (acción
   * manual, útil tras añadir un `cover.jpg` a una carpeta); sin él solo las que
   * nunca se verificaron (`artwork_checked_at IS NULL`), que son las filas
   * anteriores a la migración V7. Así el barrido automático corre una sola vez
   * por pista y no penaliza los arranques siguientes.
   */
  async getArtworkCandidates(force = false): Promise<ArtworkCandidate[]> {
    const db = await getDatabase();
    const pending = force
      ? 's.artwork_uri IS NULL'
      : 's.artwork_uri IS NULL AND s.artwork_checked_at IS NULL';
    const rows = await db.getAllAsync<{
      id: number;
      media_id: string;
      uri: string;
      album_id: number;
    }>(
      `SELECT s.id, s.media_id, s.uri, s.album_id
       FROM songs s
       WHERE s.is_available = 1 AND ${pending}`
    );
    return rows.map((row) => ({
      id: row.id,
      mediaId: row.media_id,
      uri: row.uri,
      albumId: row.album_id,
    }));
  },

  /**
   * Persiste el resultado del barrido de un álbum: asigna la portada hallada
   * (si la hay) y sella `artwork_checked_at` en sus pistas candidatas.
   *
   * LÓGICA: la portada del álbum solo se completa si aún no tenía (no se pisa
   * con la de otra pista del mismo disco). El sellado es por pista, de modo que
   * un barrido interrumpido a mitad se reanuda donde quedó.
   */
  async applyArtworkBackfill(params: {
    songIds: number[];
    albumId: number;
    artwork: string | null;
    checkedAt: number;
  }): Promise<void> {
    const { songIds, albumId, artwork, checkedAt } = params;
    if (songIds.length === 0) {
      return;
    }
    const db = await getDatabase();
    await db.withTransactionAsync(async () => {
      for (const chunk of chunksOf(songIds, ID_CHUNK_SIZE)) {
        const placeholders = chunk.map(() => '?').join(',');
        if (artwork) {
          await db.runAsync(
            `UPDATE songs SET artwork_uri = ?, artwork_checked_at = ?
             WHERE id IN (${placeholders})`,
            artwork,
            checkedAt,
            ...chunk
          );
        } else {
          await db.runAsync(
            `UPDATE songs SET artwork_checked_at = ? WHERE id IN (${placeholders})`,
            checkedAt,
            ...chunk
          );
        }
      }
      if (artwork) {
        await db.runAsync(
          'UPDATE albums SET artwork_uri = COALESCE(artwork_uri, ?) WHERE id = ?',
          artwork,
          albumId
        );
      }
    });
  },

  /** Ids de mediateca de las canciones disponibles (para detectar cambios). */
  async getAvailableMediaIds(): Promise<Set<string>> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{ media_id: string }>(
      'SELECT media_id FROM songs WHERE is_available = 1'
    );
    return new Set(rows.map((row) => row.media_id));
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
    const map = new Map<number, Song>();
    // Bibliotecas grandes pueden pedir más de 999 ids; se consulta por bloques.
    for (const chunk of chunksOf([...new Set(ids)], ID_CHUNK_SIZE)) {
      const placeholders = chunk.map(() => '?').join(',');
      const rows = await db.getAllAsync<SongRow>(
        `${SELECT_SONGS} WHERE s.id IN (${placeholders})`,
        ...chunk
      );
      for (const row of rows) {
        map.set(row.id, mapSong(row));
      }
    }
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
    const rows = await db.getAllAsync<{
      id: number;
      album: string;
      artist: string;
      title: string;
      uri: string;
      folder: string | null;
      duration: number;
    }>(
      `SELECT s.id, al.title AS album, ar.name AS artist,
              s.title, s.uri, s.folder_name AS folder, s.duration
       FROM songs s
       JOIN albums al ON al.id = s.album_id
       JOIN artists ar ON ar.id = s.artist_id
       WHERE s.is_available = 1`
    );
    const detected = detectAudiobookSongIds(rows);
    await db.runAsync('UPDATE songs SET is_audiobook = 0 WHERE audiobook_manual = 0');
    for (const chunk of chunksOf([...detected], ID_CHUNK_SIZE)) {
      const placeholders = chunk.map(() => '?').join(',');
      await db.runAsync(
        `UPDATE songs SET is_audiobook = 1
         WHERE audiobook_manual = 0 AND id IN (${placeholders})`,
        ...chunk
      );
    }
  },

  /** Marca canciones como audiolibro (o las devuelve a Canciones). */
  async setAudiobook(songIds: number[], isAudiobook: boolean): Promise<void> {
    if (songIds.length === 0) {
      return;
    }
    const db = await getDatabase();
    for (const chunk of chunksOf(songIds, ID_CHUNK_SIZE)) {
      const placeholders = chunk.map(() => '?').join(',');
      await db.runAsync(
        `UPDATE songs SET is_audiobook = ?, audiobook_manual = 1 WHERE id IN (${placeholders})`,
        isAudiobook ? 1 : 0,
        ...chunk
      );
    }
  },
};
