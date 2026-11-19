import { ERROR_LOGS_LIMIT, errorLogRepository } from '@/data/repositories/error-log.repository';
import { createFakeDatabase } from '@/testing/mocks/database';
import type { ErrorLogEntry } from '@/types/error-log';

/**
 * Pruebas del registro local de errores con un SQLite falso.
 *
 * LÓGICA: la huella agrupa sucesos repetidos (upsert + poda), `list` filtra
 * opcionalmente por nivel y las filas se devuelven con el nivel tipado.
 */
const mockFake = createFakeDatabase();

jest.mock('@/data/db/database', () => ({
  getDatabase: jest.fn(async () => mockFake.db),
}));

function logRow() {
  return {
    id: 3,
    level: 'warning',
    scope: 'audio/lock-screen',
    action: 'setActive',
    message: 'sin dispositivo',
    occurrences: 2,
    first_seen_at: 100,
    last_seen_at: 200,
  };
}

beforeEach(() => {
  mockFake.clear();
  jest.clearAllMocks();
});

describe('errorLogRepository.record', () => {
  it('hace upsert por huella y poda los registros antiguos', async () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(4_000);

    try {
      await errorLogRepository.record({
        level: 'warning',
        scope: 'audio/lock-screen',
        action: 'setActive',
        message: 'sin dispositivo',
      });
    } finally {
      nowSpy.mockRestore();
    }

    expect(mockFake.runs).toHaveLength(2);
    const [upsert, prune] = mockFake.runs;
    expect(upsert.sql).toContain('INSERT INTO error_logs');
    expect(upsert.sql).toContain('ON CONFLICT(fingerprint) DO UPDATE SET');
    expect(upsert.sql).toContain('occurrences = occurrences + 1');
    expect(upsert.sql).toContain('last_seen_at = excluded.last_seen_at');
    expect(upsert.params).toEqual([
      'warning',
      'audio/lock-screen',
      'setActive',
      'sin dispositivo',
      'warning|audio/lock-screen|setActive|sin dispositivo',
      4_000,
      4_000,
    ]);

    expect(prune.sql).toContain('DELETE FROM error_logs');
    expect(prune.sql).toContain('ORDER BY last_seen_at DESC LIMIT ?');
    expect(prune.params).toEqual([ERROR_LOGS_LIMIT]);
  });
});

describe('errorLogRepository.list', () => {
  it('pide los registros recientes y mapea las filas', async () => {
    mockFake.setAll(() => [logRow()]);

    const entries = await errorLogRepository.list();

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      id: 3,
      level: 'warning',
      scope: 'audio/lock-screen',
      action: 'setActive',
      message: 'sin dispositivo',
      occurrences: 2,
    });
    const sql = mockFake.db.getAllAsync.mock.calls[0][0] as string;
    expect(sql).toContain('ORDER BY last_seen_at DESC');
    expect(sql).not.toContain('WHERE level = ?');
    expect(mockFake.db.getAllAsync.mock.calls[0][1]).toBe(ERROR_LOGS_LIMIT);
  });

  it('filtra por nivel cuando se pide', async () => {
    mockFake.setAll(() => []);

    await expect(errorLogRepository.list('error')).resolves.toEqual([]);

    const sql = mockFake.db.getAllAsync.mock.calls[0][0] as string;
    expect(sql).toContain('WHERE level = ?');
    expect(mockFake.db.getAllAsync.mock.calls[0].slice(1)).toEqual([
      'error',
      ERROR_LOGS_LIMIT,
    ]);
  });

  it('respeta el tipo de nivel de las filas devueltas', async () => {
    mockFake.setAll(() => [{ ...logRow(), level: 'error' }]);

    const entries: ErrorLogEntry[] = await errorLogRepository.list();

    expect(entries[0].level).toBe('error');
  });
});

describe('errorLogRepository.count', () => {
  it('devuelve el total de la consulta', async () => {
    mockFake.setFirst(() => ({ total: 7 }));

    await expect(errorLogRepository.count()).resolves.toBe(7);

    expect(mockFake.db.getFirstAsync).toHaveBeenCalledWith(
      'SELECT COUNT(*) AS total FROM error_logs'
    );
  });

  it('devuelve cero sin fila', async () => {
    await expect(errorLogRepository.count()).resolves.toBe(0);
  });
});

describe('errorLogRepository.clear', () => {
  it('borra todos los registros', async () => {
    await errorLogRepository.clear();

    expect(mockFake.runs).toEqual([{ sql: 'DELETE FROM error_logs', params: [] }]);
  });
});
