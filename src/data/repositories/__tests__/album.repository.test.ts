import { albumRepository } from '@/data/repositories/album.repository';
import { createFakeDatabase } from '@/testing/mocks/database';

/**
 * Pruebas del repositorio de álbumes con un SQLite falso.
 *
 * LÓGICA: la consulta agrega solo pistas disponibles y exige álbumes con
 * canciones; las filas se mapean de snake_case a la forma de dominio.
 */
const mockFake = createFakeDatabase();

jest.mock('@/data/db/database', () => ({
  getDatabase: jest.fn(async () => mockFake.db),
}));

function albumRow() {
  return {
    id: 5,
    title: 'Disco',
    artist: 'Artista',
    artwork_uri: 'file:///cartel.jpg',
    song_count: 12,
    total_duration: 3_600,
    created_at: 1_000,
  };
}

beforeEach(() => {
  mockFake.clear();
  jest.clearAllMocks();
});

describe('albumRepository.getAll', () => {
  it('filtra, ordena y mapea los álbumes', async () => {
    mockFake.setAll(() => [albumRow()]);

    await expect(albumRepository.getAll()).resolves.toEqual([
      {
        id: 5,
        title: 'Disco',
        artist: 'Artista',
        artwork: 'file:///cartel.jpg',
        songCount: 12,
        totalDuration: 3_600,
        createdAt: 1_000,
      },
    ]);

    const sql = mockFake.db.getAllAsync.mock.calls[0][0] as string;
    expect(sql).toContain('JOIN artists ar ON ar.id = al.artist_id');
    expect(sql).toContain('s.is_available = 1');
    expect(sql).toContain('COUNT(s.id) AS song_count');
    expect(sql).toContain('COALESCE(SUM(s.duration), 0) AS total_duration');
    expect(sql).toContain('GROUP BY al.id');
    expect(sql).toContain('HAVING song_count > 0');
    expect(sql).toContain('ORDER BY al.title COLLATE NOCASE ASC');
  });

  it('devuelve una lista vacía sin álbumes con pistas', async () => {
    await expect(albumRepository.getAll()).resolves.toEqual([]);
  });
});

describe('albumRepository.getById', () => {
  it('busca por id y mapea la fila', async () => {
    mockFake.setFirst(() => albumRow());

    await expect(albumRepository.getById(5)).resolves.toEqual({
      id: 5,
      title: 'Disco',
      artist: 'Artista',
      artwork: 'file:///cartel.jpg',
      songCount: 12,
      totalDuration: 3_600,
      createdAt: 1_000,
    });

    const [sql, id] = mockFake.db.getFirstAsync.mock.calls[0];
    expect(sql).toContain('WHERE al.id = ?');
    expect(sql).toContain('HAVING song_count > 0');
    expect(id).toBe(5);
  });

  it('devuelve null cuando el álbum no existe o no tiene pistas', async () => {
    await expect(albumRepository.getById(99)).resolves.toBeNull();
  });
});
