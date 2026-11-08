import { getDatabase } from '@/data/db/database';
import type { Album } from '@/types/song';

type AlbumRow = {
  id: number;
  title: string;
  artist: string;
  artwork_uri: string | null;
  song_count: number;
  total_duration: number;
  created_at: number;
};

const SELECT_ALBUMS = `
  SELECT al.id,
         al.title,
         ar.name AS artist,
         al.artwork_uri,
         COUNT(s.id) AS song_count,
         COALESCE(SUM(s.duration), 0) AS total_duration,
         al.created_at
  FROM albums al
  JOIN artists ar ON ar.id = al.artist_id
  LEFT JOIN songs s ON s.album_id = al.id AND s.is_available = 1
`;

function mapAlbum(row: AlbumRow): Album {
  return {
    id: row.id,
    title: row.title,
    artist: row.artist,
    artwork: row.artwork_uri,
    songCount: row.song_count,
    totalDuration: row.total_duration,
    createdAt: row.created_at,
  };
}

export const albumRepository = {
  async getAll(): Promise<Album[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<AlbumRow>(`
      ${SELECT_ALBUMS}
      GROUP BY al.id
      HAVING song_count > 0
      ORDER BY al.title COLLATE NOCASE ASC
    `);
    return rows.map(mapAlbum);
  },

  async getById(id: number): Promise<Album | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<AlbumRow>(
      `${SELECT_ALBUMS}
       WHERE al.id = ?
       GROUP BY al.id
       HAVING song_count > 0`,
      id
    );
    return row ? mapAlbum(row) : null;
  },
};
