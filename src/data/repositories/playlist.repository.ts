import { getDatabase } from '@/data/db/database';
import { songRepository } from '@/data/repositories/song.repository';
import type { Song } from '@/types/song';
import type { AutoPlaylistKey, Playlist } from '@/types/playlist';

type PlaylistRow = {
  id: number;
  name: string;
  is_auto: number;
  auto_key: AutoPlaylistKey | null;
  created_at: number;
  updated_at: number;
  song_id: number | null;
};

async function normalizePositions(playlistId: number): Promise<void> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ song_id: number }>(
    'SELECT song_id FROM playlist_songs WHERE playlist_id = ? ORDER BY position ASC',
    playlistId
  );
  await db.withTransactionAsync(async () => {
    for (let position = 0; position < rows.length; position += 1) {
      await db.runAsync(
        'UPDATE playlist_songs SET position = ? WHERE playlist_id = ? AND song_id = ?',
        position,
        playlistId,
        rows[position].song_id
      );
    }
  });
}

export const playlistRepository = {
  async getAll(): Promise<Playlist[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<PlaylistRow>(`
      SELECT p.id, p.name, p.is_auto, p.auto_key, p.created_at, p.updated_at, ps.song_id
      FROM playlists p
      LEFT JOIN playlist_songs ps ON ps.playlist_id = p.id
      ORDER BY p.created_at DESC, ps.position ASC
    `);

    const map = new Map<number, Playlist>();
    for (const row of rows) {
      let playlist = map.get(row.id);
      if (!playlist) {
        playlist = {
          id: row.id,
          name: row.name,
          isAuto: row.is_auto === 1,
          autoKey: row.auto_key,
          songIds: [],
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };
        map.set(row.id, playlist);
      }
      if (row.song_id !== null) {
        playlist.songIds.push(row.song_id);
      }
    }
    return [...map.values()];
  },

  async create(name: string): Promise<Playlist> {
    const db = await getDatabase();
    const now = Date.now();
    const result = await db.runAsync(
      'INSERT INTO playlists (name, is_auto, auto_key, created_at, updated_at) VALUES (?, 0, NULL, ?, ?)',
      name.trim() || 'Nueva playlist',
      now,
      now
    );
    return {
      id: result.lastInsertRowId,
      name: name.trim() || 'Nueva playlist',
      isAuto: false,
      autoKey: null,
      songIds: [],
      createdAt: now,
      updatedAt: now,
    };
  },

  async rename(id: number, name: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      'UPDATE playlists SET name = ?, updated_at = ? WHERE id = ? AND is_auto = 0',
      name.trim() || 'Nueva playlist',
      Date.now(),
      id
    );
  },

  async remove(id: number): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM playlists WHERE id = ? AND is_auto = 0', id);
  },

  async addSong(playlistId: number, songId: number): Promise<void> {
    const db = await getDatabase();
    const next = await db.getFirstAsync<{ position: number }>(
      'SELECT COALESCE(MAX(position), -1) + 1 AS position FROM playlist_songs WHERE playlist_id = ?',
      playlistId
    );
    await db.runAsync(
      `INSERT INTO playlist_songs (playlist_id, song_id, position, added_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(playlist_id, song_id) DO NOTHING`,
      playlistId,
      songId,
      next?.position ?? 0,
      Date.now()
    );
    await db.runAsync('UPDATE playlists SET updated_at = ? WHERE id = ?', Date.now(), playlistId);
  },

  async removeSong(playlistId: number, songId: number): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      'DELETE FROM playlist_songs WHERE playlist_id = ? AND song_id = ?',
      playlistId,
      songId
    );
    await normalizePositions(playlistId);
  },

  async moveSong(playlistId: number, songId: number, direction: 'up' | 'down'): Promise<void> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{ song_id: number }>(
      'SELECT song_id FROM playlist_songs WHERE playlist_id = ? ORDER BY position ASC',
      playlistId
    );
    const ids = rows.map((row) => row.song_id);
    const index = ids.indexOf(songId);
    const target = direction === 'up' ? index - 1 : index + 1;
    if (index < 0 || target < 0 || target >= ids.length) {
      return;
    }
    [ids[index], ids[target]] = [ids[target], ids[index]];
    await db.withTransactionAsync(async () => {
      for (let position = 0; position < ids.length; position += 1) {
        await db.runAsync(
          'UPDATE playlist_songs SET position = ? WHERE playlist_id = ? AND song_id = ?',
          position,
          playlistId,
          ids[position]
        );
      }
    });
  },

  async getSongs(playlistId: number): Promise<Song[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{ song_id: number }>(
      'SELECT song_id FROM playlist_songs WHERE playlist_id = ? ORDER BY position ASC',
      playlistId
    );
    return songRepository.getByIds(rows.map((row) => row.song_id));
  },
};
