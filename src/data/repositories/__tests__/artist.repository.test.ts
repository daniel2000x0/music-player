import { artistRepository } from '@/data/repositories/artist.repository';
import { createFakeDatabase } from '@/testing/mocks/database';

/**
 * Pruebas del repositorio de artistas con un SQLite falso.
 *
 * LÓGICA: la consulta cuenta canciones y álbumes disponibles, conserva la
 * última reproducción (incluso nula) y mapea las filas al tipo de dominio.
 */
const mockFake = createFakeDatabase();

jest.mock('@/data/db/database', () => ({
  getDatabase: jest.fn(async () => mockFake.db),
}));

beforeEach(() => {
  mockFake.clear();
  jest.clearAllMocks();
});

describe('artistRepository.getAll', () => {
  it('agrupa, ordena y mapea los artistas', async () => {
    mockFake.setAll(() => [
      { id: 2, name: 'Zeta', song_count: 10, album_count: 2, last_played_at: 8_000 },
      { id: 1, name: 'Alfa', song_count: 3, album_count: 1, last_played_at: null },
    ]);

    await expect(artistRepository.getAll()).resolves.toEqual([
      { id: 2, name: 'Zeta', songCount: 10, albumCount: 2, lastPlayedAt: 8_000 },
      { id: 1, name: 'Alfa', songCount: 3, albumCount: 1, lastPlayedAt: null },
    ]);

    const sql = mockFake.db.getAllAsync.mock.calls[0][0] as string;
    expect(sql).toContain('COUNT(DISTINCT s.id) AS song_count');
    expect(sql).toContain('COUNT(DISTINCT s.album_id) AS album_count');
    expect(sql).toContain('MAX(s.last_played_at) AS last_played_at');
    expect(sql).toContain('s.is_available = 1');
    expect(sql).toContain('GROUP BY ar.id');
    expect(sql).toContain('HAVING song_count > 0');
    expect(sql).toContain('ORDER BY ar.name COLLATE NOCASE ASC');
  });

  it('devuelve una lista vacía sin artistas con pistas', async () => {
    await expect(artistRepository.getAll()).resolves.toEqual([]);
  });
});
