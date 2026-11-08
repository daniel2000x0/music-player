import { getDatabase } from '@/data/db/database';

export const favoriteRepository = {
  async getIds(): Promise<number[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{ song_id: number }>(
      'SELECT song_id FROM favorites ORDER BY created_at DESC'
    );
    return rows.map((row) => row.song_id);
  },

  async toggle(songId: number): Promise<boolean> {
    const db = await getDatabase();
    const existing = await db.getFirstAsync<{ song_id: number }>(
      'SELECT song_id FROM favorites WHERE song_id = ?',
      songId
    );
    if (existing) {
      await db.runAsync('DELETE FROM favorites WHERE song_id = ?', songId);
      return false;
    }
    await db.runAsync(
      'INSERT INTO favorites (song_id, created_at) VALUES (?, ?)',
      songId,
      Date.now()
    );
    return true;
  },

  async clear(): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM favorites');
  },
};
