import { HISTORY_LIMIT, historyRepository } from '@/data/repositories/history.repository';
import { createFakeDatabase } from '@/testing/mocks/database';

/**
 * Pruebas del historial con un SQLite falso.
 *
 * LÓGICA: `record` agrupa tres escrituras en una transacción (inserción,
 * contador de reproducciones y poda), `getRecent` agrupa por canción y `clear`
 * reinicia también las estadísticas.
 */
const mockFake = createFakeDatabase();

jest.mock('@/data/db/database', () => ({
  getDatabase: jest.fn(async () => mockFake.db),
}));

beforeEach(() => {
  mockFake.clear();
  jest.clearAllMocks();
});

describe('historyRepository.record', () => {
  it('inserta, incrementa y poda en una sola transacción', async () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(5_000);

    try {
      await historyRepository.record(7, 120, true);
    } finally {
      nowSpy.mockRestore();
    }

    expect(mockFake.db.withTransactionAsync).toHaveBeenCalledTimes(1);
    expect(mockFake.transactions).toEqual([0]);
    expect(mockFake.runs).toHaveLength(3);

    const [insert, update, prune] = mockFake.runs;
    expect(insert.sql).toContain('INSERT INTO playback_history');
    expect(insert.sql).toContain('(song_id, played_at, listened_seconds, completed)');
    expect(insert.params).toEqual([7, 5_000, 120, 1]);

    expect(update.sql).toContain('SET play_count = play_count + 1, last_played_at = ?');
    expect(update.sql).toContain('WHERE id = ?');
    expect(update.params).toEqual([5_000, 7]);

    expect(prune.sql).toContain('DELETE FROM playback_history');
    expect(prune.sql).toContain('ORDER BY played_at DESC LIMIT ?');
    expect(prune.params).toEqual([HISTORY_LIMIT]);
  });

  it('guarda completed como 0 cuando la reproducción no terminó', async () => {
    await historyRepository.record(3, 15, false);

    expect(mockFake.runs[0].params[3]).toBe(0);
  });
});

describe('historyRepository.getRecent', () => {
  it('mapea las filas y aplica el límite pedido', async () => {
    mockFake.setAll(() => [
      { song_id: 4, played_at: 900 },
      { song_id: 1, played_at: 700 },
    ]);

    await expect(historyRepository.getRecent(8)).resolves.toEqual([
      { songId: 4, playedAt: 900 },
      { songId: 1, playedAt: 700 },
    ]);

    const sql = mockFake.db.getAllAsync.mock.calls[0][0] as string;
    expect(sql).toContain('SELECT song_id, MAX(played_at) AS played_at');
    expect(sql).toContain('GROUP BY song_id');
    expect(sql).toContain('ORDER BY played_at DESC');
    expect(sql).toContain('LIMIT ?');
    expect(mockFake.db.getAllAsync.mock.calls[0][1]).toBe(8);
  });

  it('usa 50 entradas por defecto', async () => {
    await historyRepository.getRecent();

    expect(mockFake.db.getAllAsync.mock.calls[0][1]).toBe(50);
  });
});

describe('historyRepository.clear', () => {
  it('borra el historial y reinicia los contadores de reproducción', async () => {
    await historyRepository.clear();

    expect(mockFake.runs).toHaveLength(2);
    expect(mockFake.runs[0].sql).toBe('DELETE FROM playback_history');
    expect(mockFake.runs[1].sql).toBe(
      'UPDATE songs SET play_count = 0, last_played_at = NULL'
    );
    expect(mockFake.transactions).toHaveLength(0);
  });
});
