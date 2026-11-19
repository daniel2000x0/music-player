import { favoriteRepository } from '@/data/repositories/favorite.repository';
import { createFakeDatabase } from '@/testing/mocks/database';

/**
 * Pruebas de favoritos con un SQLite falso.
 *
 * LÓGICA: los ids se devuelven en orden de creación descendente, `toggle`
 * decide insertar o borrar según la fila existente y devuelve el estado final.
 */
const mockFake = createFakeDatabase();

jest.mock('@/data/db/database', () => ({
  getDatabase: jest.fn(async () => mockFake.db),
}));

beforeEach(() => {
  mockFake.clear();
  jest.clearAllMocks();
});

describe('favoriteRepository.getIds', () => {
  it('mapea las filas a ids en el orden de la consulta', async () => {
    mockFake.setAll(() => [{ song_id: 9 }, { song_id: 3 }, { song_id: 7 }]);

    await expect(favoriteRepository.getIds()).resolves.toEqual([9, 3, 7]);

    expect(mockFake.db.getAllAsync).toHaveBeenCalledWith(
      'SELECT song_id FROM favorites ORDER BY created_at DESC'
    );
  });

  it('devuelve una lista vacía sin favoritos', async () => {
    await expect(favoriteRepository.getIds()).resolves.toEqual([]);
  });
});

describe('favoriteRepository.toggle', () => {
  it('inserta y devuelve true cuando la canción no estaba marcada', async () => {
    mockFake.setFirst(() => null);

    await expect(favoriteRepository.toggle(12)).resolves.toBe(true);

    expect(mockFake.db.getFirstAsync).toHaveBeenCalledWith(
      'SELECT song_id FROM favorites WHERE song_id = ?',
      12
    );
    const insert = mockFake.callsMatching('INSERT INTO favorites')[0];
    expect(insert.sql).toContain('(song_id, created_at) VALUES (?, ?)');
    expect(insert.params).toEqual([12, expect.any(Number)]);
    expect(mockFake.callsMatching('DELETE FROM favorites')).toHaveLength(0);
  });

  it('borra y devuelve false cuando la canción ya estaba marcada', async () => {
    mockFake.setFirst(() => ({ song_id: 12 }));

    await expect(favoriteRepository.toggle(12)).resolves.toBe(false);

    expect(mockFake.last()?.sql).toBe('DELETE FROM favorites WHERE song_id = ?');
    expect(mockFake.last()?.params).toEqual([12]);
    expect(mockFake.callsMatching('INSERT INTO favorites')).toHaveLength(0);
  });
});

describe('favoriteRepository.clear', () => {
  it('borra todos los favoritos', async () => {
    await favoriteRepository.clear();

    expect(mockFake.runs).toHaveLength(1);
    expect(mockFake.last()?.sql).toBe('DELETE FROM favorites');
    expect(mockFake.last()?.params).toEqual([]);
  });
});
