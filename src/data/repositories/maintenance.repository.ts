import { getDatabase } from '@/data/db/database';

export const maintenanceRepository = {
  /**
   * Elimina la información administrativa del usuario (favoritos, playlists,
   * historial y estadísticas). No borra las canciones registradas ni los
   * archivos de audio del dispositivo.
   */
  async clearAdministrativeData(): Promise<void> {
    const db = await getDatabase();
    await db.withTransactionAsync(async () => {
      await db.runAsync('DELETE FROM favorites');
      await db.runAsync('DELETE FROM playlist_songs');
      await db.runAsync('DELETE FROM playlists WHERE is_auto = 0');
      await db.runAsync('DELETE FROM playback_history');
      await db.runAsync('UPDATE songs SET play_count = 0, last_played_at = NULL');
    });
  },
};
