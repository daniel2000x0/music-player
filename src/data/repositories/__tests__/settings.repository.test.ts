import { settingsRepository } from '@/data/repositories/settings.repository';
import { createFakeDatabase } from '@/testing/mocks/database';
import { DEFAULT_SETTINGS } from '@/types/settings';

/**
 * Pruebas de los ajustes persistentes con un SQLite falso.
 *
 * LÓGICA: la fila única se lee como JSON y se valida al recuperarla (tema,
 * volumen finito y acotado a 0–1). Escritura parcial = lee-modifica-escribe.
 */
const mockFake = createFakeDatabase();

jest.mock('@/data/db/database', () => ({
  getDatabase: jest.fn(async () => mockFake.db),
}));

function row(value: string): { value: string } {
  return { value };
}

beforeEach(() => {
  mockFake.clear();
  jest.clearAllMocks();
});

describe('settingsRepository.get', () => {
  it('devuelve los ajustes por defecto cuando no hay fila', async () => {
    await expect(settingsRepository.get()).resolves.toEqual(DEFAULT_SETTINGS);

    expect(mockFake.db.getFirstAsync).toHaveBeenCalledWith(
      "SELECT value FROM app_settings WHERE key = 'app'"
    );
  });

  it('devuelve el tema y el volumen guardados', async () => {
    mockFake.setFirst(() => row('{"theme":"light","volume":0.35}'));

    await expect(settingsRepository.get()).resolves.toEqual({
      theme: 'light',
      volume: 0.35,
    });
  });

  it('descarta un JSON corrupto en lugar de lanzar', async () => {
    mockFake.setFirst(() => row('no es json'));

    await expect(settingsRepository.get()).resolves.toEqual(DEFAULT_SETTINGS);
  });

  it('acota el volumen fuera de rango y normaliza valores no numéricos', async () => {
    const valores = ['{"theme":"dark","volume":7}', '{"theme":"dark","volume":-2}',
      '{"theme":"dark","volume":"alto"}', '{"theme":"otro","volume":null}'];
    mockFake.setFirst(() => row(valores.shift() ?? '{}'));

    await expect(settingsRepository.get()).resolves.toEqual({ theme: 'dark', volume: 1 });
    await expect(settingsRepository.get()).resolves.toEqual({ theme: 'dark', volume: 0 });
    await expect(settingsRepository.get()).resolves.toEqual({ theme: 'dark', volume: 1 });
    // Tema desconocido -> dark y volumen ausente/inválido -> el de por defecto.
    await expect(settingsRepository.get()).resolves.toEqual(DEFAULT_SETTINGS);
  });
});

describe('settingsRepository.setTheme', () => {
  it('conserva el volumen al cambiar el tema', async () => {
    mockFake.setFirst(() => row('{"theme":"dark","volume":0.4}'));

    await settingsRepository.setTheme('light');

    const write = mockFake.last();
    expect(mockFake.db.getFirstAsync).toHaveBeenCalledTimes(1);
    expect(write?.sql).toContain('INSERT INTO app_settings (key, value)');
    expect(write?.sql).toContain('ON CONFLICT(key) DO UPDATE SET value = excluded.value');
    expect(write?.params).toHaveLength(1);
    expect(JSON.parse(String(write?.params[0]))).toEqual({ theme: 'light', volume: 0.4 });
  });
});

describe('settingsRepository.setVolume', () => {
  it('conserva el tema y acota el volumen antes de guardar', async () => {
    mockFake.setFirst(() => row('{"theme":"light","volume":0.2}'));

    await settingsRepository.setVolume(3);

    expect(JSON.parse(String(mockFake.last()?.params[0]))).toEqual({
      theme: 'light',
      volume: 1,
    });
  });

  it('guarda cero cuando el volumen es negativo', async () => {
    mockFake.setFirst(() => row('{"theme":"dark","volume":0.8}'));

    await settingsRepository.setVolume(-5);

    expect(JSON.parse(String(mockFake.last()?.params[0]))).toEqual({
      theme: 'dark',
      volume: 0,
    });
  });
});
