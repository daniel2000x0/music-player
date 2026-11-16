import { songRepository } from '@/data/repositories/song.repository';
import type { ScannedSong } from '@/types/song';

/**
 * Pruebas de la persistencia por lotes con un SQLite falso.
 *
 * LÓGICA: se registra cada sentencia para verificar los contratos que importan
 * en bibliotecas grandes: una transacción por lote, sentencias de ≤50 filas,
 * chunks de ≤500 ids y ausencia del reset global de disponibilidad.
 */
type Row = Record<string, unknown>;

const mockRunLog: { sql: string; params: unknown[] }[] = [];
const mockArtistRows = new Map<string, { id: number }>();
const mockAlbumRows = new Map<string, { id: number; artwork_uri: string | null }>();
let mockNextId = 1;
let mockAllHandler: (sql: string, params: unknown[]) => Row[] = () => [];

const mockDb = {
  withTransactionAsync: jest.fn(async (fn: () => Promise<void>) => {
    await fn();
  }),
  runAsync: jest.fn(async (sql: string, ...params: unknown[]) => {
    mockRunLog.push({ sql, params });
    return { lastInsertRowId: mockNextId++, changes: 1 };
  }),
  getFirstAsync: jest.fn(async (sql: string, ...params: unknown[]) => {
    if (sql.includes('FROM artists')) {
      return mockArtistRows.get(String(params[0])) ?? null;
    }
    if (sql.includes('FROM albums')) {
      return mockAlbumRows.get(`${params[1]}\u0000${params[0]}`) ?? null;
    }
    return null;
  }),
  getAllAsync: jest.fn(async (sql: string, ...params: unknown[]) =>
    mockAllHandler(sql, params)
  ),
};

jest.mock('@/data/db/database', () => ({
  getDatabase: jest.fn(async () => mockDb),
}));

function scanned(mediaId: string, modificationTime: number | null = 10): ScannedSong {
  return {
    mediaId,
    uri: `file:///music/${mediaId}.mp3`,
    title: mediaId,
    artist: 'Artista',
    album: 'Álbum',
    track: 1,
    folder: 'Music',
    duration: 180,
    artwork: null,
    modificationTime,
  };
}

function songRow(id: number): Row {
  return {
    id,
    media_id: `m-${id}`,
    uri: `file:///music/m-${id}.mp3`,
    title: `Título ${id}`,
    artist: 'Artista',
    album: 'Álbum',
    track_number: null,
    folder_name: null,
    duration: 100,
    artwork_uri: null,
    added_at: 1,
    is_available: 1,
    is_audiobook: 0,
    play_count: 0,
    last_played_at: null,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRunLog.length = 0;
  mockArtistRows.clear();
  mockAlbumRows.clear();
  mockNextId = 1;
  mockAllHandler = () => [];
});

describe('songRepository.upsertBatch', () => {
  it('no abre transacción para un lote vacío', async () => {
    await songRepository.upsertBatch([]);

    expect(mockDb.withTransactionAsync).not.toHaveBeenCalled();
  });

  it('escribe en una transacción con sentencias de 50 filas', async () => {
    const songs = Array.from({ length: 120 }, (_, index) =>
      scanned(`m-${index}`, index + 1)
    );

    await songRepository.upsertBatch(songs);

    expect(mockDb.withTransactionAsync).toHaveBeenCalledTimes(1);
    const inserts = mockRunLog.filter((entry) => entry.sql.includes('INSERT INTO songs'));
    expect(inserts).toHaveLength(3);
    expect(inserts.map((entry) => entry.params.length)).toEqual([600, 600, 240]);
    expect(inserts[0].sql).toContain('modification_time');
    // El valor guardado es el de la mediateca, no un contador del bucle.
    expect(inserts[0].params[11]).toBe(1);
  });

  it('nunca resetea la disponibilidad de toda la tabla', async () => {
    await songRepository.upsertBatch([scanned('m-1')]);

    expect(
      mockRunLog.some((entry) => entry.sql.includes('UPDATE songs SET is_available = 0'))
    ).toBe(false);
  });

  it('resuelve artistas y álbumes una sola vez por lote', async () => {
    await songRepository.upsertBatch([scanned('m-1'), scanned('m-2')]);

    expect(mockRunLog.filter((entry) => entry.sql.includes('INSERT INTO artists'))).toHaveLength(1);
    expect(mockRunLog.filter((entry) => entry.sql.includes('INSERT INTO albums'))).toHaveLength(1);
  });
});

describe('songRepository.markMissing', () => {
  it('marca por chunks de 500 ids sin borrar filas', async () => {
    const ids = Array.from({ length: 1_200 }, (_, index) => `m-${index}`);

    await songRepository.markMissing(ids);

    const updates = mockRunLog.filter((entry) =>
      entry.sql.includes('SET is_available = 0')
    );
    expect(updates).toHaveLength(3);
    expect(updates.map((entry) => entry.params.length)).toEqual([500, 500, 200]);
    expect(updates.every((entry) => entry.sql.startsWith('UPDATE songs SET'))).toBe(true);
  });

  it('no consulta SQLite sin ids', async () => {
    await songRepository.markMissing([]);

    expect(mockRunLog).toHaveLength(0);
  });
});

describe('songRepository.setAudiobook', () => {
  it('actualiza por chunks de 500 ids', async () => {
    const ids = Array.from({ length: 1_200 }, (_, index) => index + 1);

    await songRepository.setAudiobook(ids, true);

    const updates = mockRunLog.filter((entry) =>
      entry.sql.includes('audiobook_manual = 1')
    );
    expect(updates).toHaveLength(3);
    expect(updates[0].params[0]).toBe(1);
    expect(updates.map((entry) => entry.params.length)).toEqual([501, 501, 201]);
  });
});

describe('songRepository.getByIds', () => {
  it('consulta por chunks de 500 y conserva el orden pedido', async () => {
    mockAllHandler = (_sql, params) => params.map((id) => songRow(Number(id)));
    const ids = Array.from({ length: 1_200 }, (_, index) => index + 1);

    const songs = await songRepository.getByIds(ids);

    expect(mockDb.getAllAsync).toHaveBeenCalledTimes(3);
    expect(songs).toHaveLength(1_200);
    expect(songs[0].id).toBe(1);
    expect(songs.at(-1)?.id).toBe(1_200);
  });

  it('resuelve ids repetidos sin duplicar la consulta', async () => {
    mockAllHandler = (_sql, params) => params.map((id) => songRow(Number(id)));

    const songs = await songRepository.getByIds([2, 1, 2]);

    expect(mockDb.getAllAsync).toHaveBeenCalledTimes(1);
    expect(songs.map((song) => song.id)).toEqual([2, 1, 2]);
  });
});

describe('songRepository.getScanState', () => {
  it('conserva la fecha nula y la disponibilidad de las filas migradas', async () => {
    mockAllHandler = () => [
      { media_id: 'vieja', modification_time: null, is_available: 1 },
      { media_id: 'podada', modification_time: 50, is_available: 0 },
    ];

    const state = await songRepository.getScanState();

    expect(state).toEqual([
      { mediaId: 'vieja', modificationTime: null, isAvailable: true },
      { mediaId: 'podada', modificationTime: 50, isAvailable: false },
    ]);
  });
});
