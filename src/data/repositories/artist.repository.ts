import { getDatabase } from '@/data/db/database';
import type { Artist } from '@/types/song';

type ArtistRow = {
  id: number;
  name: string;
  song_count: number;
  album_count: number;
  last_played_at: number | null;
};

export const artistRepository = {
  async getAll(): Promise<Artist[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<ArtistRow>(`
      SELECT ar.id,
             ar.name,
             COUNT(DISTINCT s.id) AS song_count,
             COUNT(DISTINCT s.album_id) AS album_count,
             MAX(s.last_played_at) AS last_played_at
      FROM artists ar
      LEFT JOIN songs s ON s.artist_id = ar.id AND s.is_available = 1
      GROUP BY ar.id
      HAVING song_count > 0
      ORDER BY ar.name COLLATE NOCASE ASC
    `);

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      songCount: row.song_count,
      albumCount: row.album_count,
      lastPlayedAt: row.last_played_at,
    }));
  },
};
