import { playbackSessionRepository } from '@/data/repositories/playback-session.repository';
import type { PlaybackSession } from '@/domain/playback/session';

/**
 * Pruebas del repositorio de la sesión con un SQLite falso.
 *
 * LÓGICA: se verifica el contrato que importa: una sola fila (`id = 1`), upsert
 * en vez de insert ciego, lectura validada por el dominio y borrado.
 */
const mockRunLog: { sql: string; params: unknown[] }[] = [];
let mockRow: { payload: string } | null = null;

const mockDb = {
  runAsync: jest.fn(async (sql: string, ...params: unknown[]) => {
    mockRunLog.push({ sql, params });
    return { lastInsertRowId: 1, changes: 1 };
  }),
  getFirstAsync: jest.fn(async () => mockRow),
};

jest.mock('@/data/db/database', () => ({
  getDatabase: jest.fn(async () => mockDb),
}));

function session(overrides: Partial<PlaybackSession> = {}): PlaybackSession {
  return {
    queueSongIds: [1, 2],
    currentSongId: 2,
    positionSeconds: 30,
    repeatMode: 'single',
    shuffle: false,
    updatedAt: 5_000,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRunLog.length = 0;
  mockRow = null;
});

describe('playbackSessionRepository.save', () => {
  it('hace upsert de la fila única con el payload serializado', async () => {
    await playbackSessionRepository.save(session());

    expect(mockRunLog).toHaveLength(1);
    expect(mockRunLog[0].sql).toContain('INSERT INTO playback_sessions');
    expect(mockRunLog[0].sql).toContain('ON CONFLICT(id) DO UPDATE');
    expect(mockRunLog[0].params[0]).toBe(1);
    expect(JSON.parse(String(mockRunLog[0].params[1]))).toMatchObject({
      queueSongIds: [1, 2],
      currentSongId: 2,
    });
    expect(mockRunLog[0].params[2]).toBe(5_000);
  });
});

describe('playbackSessionRepository.load', () => {
  it('devuelve null cuando no hay fila', async () => {
    expect(await playbackSessionRepository.load()).toBeNull();
  });

  it('valida el payload guardado antes de devolverlo', async () => {
    mockRow = { payload: '{"queueSongIds":[3],"repeatMode":"loop"}' };

    const loaded = await playbackSessionRepository.load();

    expect(loaded).toMatchObject({
      queueSongIds: [3],
      currentSongId: 3,
      repeatMode: 'none',
    });
  });

  it('descarta un payload corrupto en lugar de lanzar', async () => {
    mockRow = { payload: 'no es json' };

    expect(await playbackSessionRepository.load()).toBeNull();
  });
});

describe('playbackSessionRepository.clear', () => {
  it('borra solo la fila de la sesión', async () => {
    await playbackSessionRepository.clear();

    expect(mockRunLog[0].sql).toBe('DELETE FROM playback_sessions WHERE id = ?');
    expect(mockRunLog[0].params).toEqual([1]);
  });
});

describe('contrato con el dominio', () => {
  it('lo que se guarda se puede volver a leer igual', async () => {
    const original = session();

    await playbackSessionRepository.save(original);
    mockRow = { payload: String(mockRunLog[0].params[1]) };

    expect(await playbackSessionRepository.load()).toEqual(original);
  });
});
