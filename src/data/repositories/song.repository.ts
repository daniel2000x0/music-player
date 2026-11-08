import { getDatabase } from '@/data/db/database';
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
  play_count: number;
  last_played_at: number | null;
};

const SELECT_SONGS = `
  SELECT s.id, s.media_id, s.uri, s.title,
         ar.name AS artist, al.title AS album,
         s.duration, s.artwork_uri, s.added_at,
         s.is_available, s.play_count, s.last_played_at
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
    playCount: row.play_count,
    lastPlayedAt: row.last_played_at,
  };
}

async function getOrCreateArtistId(name: string, now: number): Promise<number> {
  const db = await getDatabase();
  const existing = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM artists WHERE name = ?',
    name
  );
  if (existing) {
    return existing.id;
  }
  const result = await db.runAsync(
    'INSERT INTO artists (name, created_at) VALUES (?, ?)',
    name,
    now
  );
  return result.lastInsertRowId;
}

async function getOrCreateAlbumId(
  title: string,
  artistId: number,
  artwork: string | null,
  now: number
): Promise<number> {
  const db = await getDatabase();
  const existing = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM albums WHERE title = ? AND artist_id = ?',
    title,
    artistId
  );
  if (existing) {
    return existing.id;
  }
  const result = await db.runAsync(
    'INSERT INTO albums (title, artist_id, artwork_uri, created_at) VALUES (?, ?, ?, ?)',
    title,
    artistId,
    artwork,
    now
  );
  return result.lastInsertRowId;
}

export const songRepository = {
  /** Sincroniza el escaneo con SQLite sin duplicar canciones. */
  async upsertScannedSongs(scanned: ScannedSong[]): Promise<void> {
    const db = await getDatabase();
    const now = Date.now();

    await db.withTransactionAsync(async () => {
      await db.runAsync('UPDATE songs SET is_available = 0');
      for (const item of scanned) {
        const artistId = await getOrCreateArtistId(item.artist, now);
        const albumId = await getOrCreateAlbumId(item.album, artistId, item.artwork, now);

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
};
