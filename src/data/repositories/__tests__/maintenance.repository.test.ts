import { maintenanceRepository } from '@/data/repositories/maintenance.repository';
import { createFakeDatabase } from '@/testing/mocks/database';

/**
 * Pruebas del borrado administrativo con un SQLite falso.
 *
 * LÓGICA: las cinco sentencias deben ir en una transacción y no pueden tocar
 * las filas de `songs` (la biblioteca del usuario se conserva).
 */
const mockFake = createFakeDatabase();

jest.mock('@/data/db/database', () => ({
  getDatabase: jest.fn(async () => mockFake.db),
}));

beforeEach(() => {
  mockFake.clear();
  jest.clearAllMocks();
});

describe('maintenanceRepository.clearAdministrativeData', () => {
  it('ejecuta en una transacción el borrado administrativo completo', async () => {
    await maintenanceRepository.clearAdministrativeData();

    expect(mockFake.db.withTransactionAsync).toHaveBeenCalledTimes(1);
    expect(mockFake.transactions).toEqual([0]);
    expect(mockFake.runs.map((call) => call.sql)).toEqual([
      'DELETE FROM favorites',
      'DELETE FROM playlist_songs',
      'DELETE FROM playlists WHERE is_auto = 0',
      'DELETE FROM playback_history',
      'UPDATE songs SET play_count = 0, last_played_at = NULL',
    ]);
    expect(mockFake.runs.every((call) => call.params.length === 0)).toBe(true);
    expect(mockFake.runs.some((call) => call.sql.includes('DELETE FROM songs'))).toBe(false);
  });
});
