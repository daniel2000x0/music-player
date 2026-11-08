import { getDatabase } from '@/data/db/database';
import type { RecentEntry } from '@/types/playlist';

export const HISTORY_LIMIT = 200;

export const historyRepository = {
  async record(songId: number, listenedSeconds: number, completed: boolean): Promise<void> {
    const db = await getDatabase();
    const playedAt = Date.now();
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `INSERT INTO playback_history (song_id, played_at, listened_seconds, completed)
         VALUES (?, ?, ?, ?)`,
        songId,
        playedAt,
        listenedSeconds,
        completed ? 1 : 0
      );
      await db.runAsync(
        `UPDATE songs
         SET play_count = play_count + 1, last_played_at = ?
         WHERE id = ?`,
        playedAt,
        songId
      );
      await db.runAsync(
        `DELETE FROM playback_history
         WHERE id NOT IN (
           SELECT id FROM playback_history ORDER BY played_at DESC LIMIT ?
         )`,
        HISTORY_LIMIT
      );
    });
  },

  async getRecent(limit = 50): Promise<RecentEntry[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{ song_id: number; played_at: number }>(
      `SELECT song_id, MAX(played_at) AS played_at
       FROM playback_history
       GROUP BY song_id
       ORDER BY played_at DESC
       LIMIT ?`,
      limit
    );
    return rows.map((row) => ({ songId: row.song_id, playedAt: row.played_at }));
  },

  async clear(): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM playback_history');
    await db.runAsync('UPDATE songs SET play_count = 0, last_played_at = NULL');
  },
};
