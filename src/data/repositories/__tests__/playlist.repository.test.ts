import { playlistRepository } from '@/data/repositories/playlist.repository';
import { songRepository } from '@/data/repositories/song.repository';
import { createFakeDatabase } from '@/testing/mocks/database';

/**
 * Pruebas del repositorio de playlists con un SQLite falso.
 *
 * LÓGICA: el JOIN se agrupa por playlist conservando el orden de posiciones,
 * las operaciones de gestión excluyen las automáticas, y los movimientos y
 * normalizaciones se escriben dentro de una transacción.
 */
const mockFake = createFakeDatabase();

jest.mock('@/data/db/database', () => ({
  getDatabase: jest.fn(async () => mockFake.db),
}));

jest.mock('@/data/repositories/song.repository', () => ({
  songRepository: { getByIds: jest.fn(async (ids: number[]) => ids) },
}));

type PlaylistRow = {
  id: number;
  name: string;
  is_auto: number;
  auto_key: string | null;
  created_at: number;
  updated_at: number;
  song_id: number | null;
};

function row(overrides: Partial<PlaylistRow> = {}): PlaylistRow {
  return {
    id: 1,
    name: 'Rock',
    is_auto: 0,
    auto_key: null,
    created_at: 100,
    updated_at: 200,
    song_id: null,
    ...overrides,
  };
}

beforeEach(() => {
  mockFake.clear();
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

describe('playlistRepository.getAll', () => {
  it('agrupa las filas del JOIN y ordena los songIds por posición', async () => {
    mockFake.setAll(() => [
      row({ id: 2, name: 'Recientes', is_auto: 1, auto_key: 'recent', song_id: 9 }),
      row({ id: 2, name: 'Recientes', is_auto: 1, auto_key: 'recent', song_id: 4 }),
      row({ id: 1, name: 'Rock', song_id: 30 }),
      row({ id: 1, name: 'Rock', song_id: 10 }),
      row({ id: 3, name: 'Vacía', created_at: 50 }),
    ]);

    const playlists = await playlistRepository.getAll();

    expect(playlists).toEqual([
      {
        id: 2,
        name: 'Recientes',
        isAuto: true,
        autoKey: 'recent',
        songIds: [9, 4],
        createdAt: 100,
        updatedAt: 200,
      },
      {
        id: 1,
        name: 'Rock',
        isAuto: false,
        autoKey: null,
        songIds: [30, 10],
        createdAt: 100,
        updatedAt: 200,
      },
      {
        id: 3,
        name: 'Vacía',
        isAuto: false,
        autoKey: null,
        songIds: [],
        createdAt: 50,
        updatedAt: 200,
      },
    ]);
    const sql = mockFake.db.getAllAsync.mock.calls[0][0] as string;
    expect(sql).toContain('LEFT JOIN playlist_songs ps ON ps.playlist_id = p.id');
    expect(sql).toContain('ORDER BY p.created_at DESC, ps.position ASC');
  });

  it('devuelve una lista vacía sin playlists', async () => {
    await expect(playlistRepository.getAll()).resolves.toEqual([]);
  });
});

describe('playlistRepository.create', () => {
  it('aplica el nombre por defecto y devuelve la fila creada', async () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(5_000);

    const playlist = await playlistRepository.create('   ');

    expect(playlist).toEqual({
      id: 1,
      name: 'Nueva playlist',
      isAuto: false,
      autoKey: null,
      songIds: [],
      createdAt: 5_000,
      updatedAt: 5_000,
    });
    const insert = mockFake.last();
    expect(insert?.sql).toBe(
      'INSERT INTO playlists (name, is_auto, auto_key, created_at, updated_at) VALUES (?, 0, NULL, ?, ?)'
    );
    expect(insert?.params).toEqual(['Nueva playlist', 5_000, 5_000]);
    nowSpy.mockRestore();
  });

  it('recorta el nombre indicado', async () => {
    await playlistRepository.create('  Mi lista  ');

    expect(mockFake.last()?.params[0]).toBe('Mi lista');
    expect((await playlistRepository.getAll()).length).toBe(0);
  });
});

describe('playlistRepository.rename', () => {
  it('actualiza nombre y fecha solo de playlists manuales', async () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(6_000);

    await playlistRepository.rename(4, '  Nueva  ');

    const update = mockFake.last();
    expect(update?.sql).toBe(
      'UPDATE playlists SET name = ?, updated_at = ? WHERE id = ? AND is_auto = 0'
    );
    expect(update?.params).toEqual(['Nueva', 6_000, 4]);
    nowSpy.mockRestore();
  });

  it('usa el nombre por defecto si el nuevo está vacío', async () => {
    await playlistRepository.rename(4, ' ');

    expect(mockFake.last()?.params[0]).toBe('Nueva playlist');
  });
});

describe('playlistRepository.remove', () => {
  it('borra solo una playlist manual', async () => {
    await playlistRepository.remove(4);

    expect(mockFake.runs).toEqual([
      { sql: 'DELETE FROM playlists WHERE id = ? AND is_auto = 0', params: [4] },
    ]);
  });
});

describe('playlistRepository.addSong', () => {
  it('calcula la siguiente posición y evita duplicados', async () => {
    mockFake.setFirst(() => ({ position: 3 }));

    await playlistRepository.addSong(2, 42);

    const lookup = mockFake.db.getFirstAsync.mock.calls[0];
    expect(lookup[0]).toContain('COALESCE(MAX(position), -1) + 1 AS position');
    expect(lookup[1]).toBe(2);

    const insert = mockFake.callsMatching('INSERT INTO playlist_songs')[0];
    expect(insert.sql).toContain('ON CONFLICT(playlist_id, song_id) DO NOTHING');
    expect(insert.params).toEqual([2, 42, 3, expect.any(Number)]);

    const touch = mockFake.callsMatching('UPDATE playlists SET updated_at')[0];
    expect(touch.params).toEqual([expect.any(Number), 2]);
  });

  it('empieza en la posición cero si la playlist está vacía', async () => {
    await playlistRepository.addSong(2, 7);

    expect(mockFake.callsMatching('INSERT INTO playlist_songs')[0].params).toEqual([
      2,
      7,
      0,
      expect.any(Number),
    ]);
  });
});

describe('playlistRepository.removeSong', () => {
  it('borra la canción y normaliza posiciones en una transacción', async () => {
    mockFake.setAll(() => [{ song_id: 10 }, { song_id: 30 }]);

    await playlistRepository.removeSong(2, 20);

    expect(mockFake.runs[0].sql).toBe(
      'DELETE FROM playlist_songs WHERE playlist_id = ? AND song_id = ?'
    );
    expect(mockFake.runs[0].params).toEqual([2, 20]);
    expect(mockFake.db.getAllAsync.mock.calls[0][0]).toContain('ORDER BY position ASC');
    expect(mockFake.db.getAllAsync.mock.calls[0][1]).toBe(2);
    expect(mockFake.transactions).toEqual([1]);
    expect(mockFake.runs.slice(1).map((call) => call.params)).toEqual([
      [0, 2, 10],
      [1, 2, 30],
    ]);
    expect(mockFake.runs[1].sql).toBe(
      'UPDATE playlist_songs SET position = ? WHERE playlist_id = ? AND song_id = ?'
    );
  });
});

describe('playlistRepository.moveSong', () => {
  it('intercambia con la canción anterior dentro de una transacción', async () => {
    mockFake.setAll(() => [{ song_id: 10 }, { song_id: 20 }, { song_id: 30 }]);

    await playlistRepository.moveSong(2, 20, 'up');

    expect(mockFake.db.withTransactionAsync).toHaveBeenCalledTimes(1);
    expect(mockFake.transactions).toEqual([0]);
    expect(mockFake.runs.map((call) => call.params)).toEqual([
      [0, 2, 20],
      [1, 2, 10],
      [2, 2, 30],
    ]);
  });

  it('intercambia con la siguiente hacia abajo', async () => {
    mockFake.setAll(() => [{ song_id: 10 }, { song_id: 20 }, { song_id: 30 }]);

    await playlistRepository.moveSong(2, 20, 'down');

    expect(mockFake.runs.map((call) => call.params)).toEqual([
      [0, 2, 10],
      [1, 2, 30],
      [2, 2, 20],
    ]);
  });

  it.each([
    ['la canción no está en la playlist', 99, 'up' as const],
    ['ya está arriba del todo', 10, 'up' as const],
    ['ya está abajo del todo', 30, 'down' as const],
  ])('no hace nada si %s', async (_description, songId, direction) => {
    mockFake.setAll(() => [{ song_id: 10 }, { song_id: 20 }, { song_id: 30 }]);

    await playlistRepository.moveSong(2, songId, direction);

    expect(mockFake.db.withTransactionAsync).not.toHaveBeenCalled();
    expect(mockFake.runs).toHaveLength(0);
  });
});

describe('playlistRepository.getSongs', () => {
  it('delega en songRepository con los ids en orden de posición', async () => {
    mockFake.setAll(() => [{ song_id: 30 }, { song_id: 10 }, { song_id: 20 }]);

    const songs = await playlistRepository.getSongs(2);

    const read = mockFake.db.getAllAsync.mock.calls[0];
    expect(read[0]).toContain('SELECT song_id FROM playlist_songs WHERE playlist_id = ?');
    expect(read[0]).toContain('ORDER BY position ASC');
    expect(read[1]).toBe(2);
    expect(songRepository.getByIds).toHaveBeenCalledWith([30, 10, 20]);
    expect(songs).toEqual([30, 10, 20]);
  });

  it('pide una lista vacía si la playlist no tiene canciones', async () => {
    await playlistRepository.getSongs(2);

    expect(songRepository.getByIds).toHaveBeenCalledWith([]);
  });
});
