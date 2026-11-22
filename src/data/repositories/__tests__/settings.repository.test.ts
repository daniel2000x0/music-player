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
      ...DEFAULT_SETTINGS,
      theme: 'light',
      volume: 0.35,
    });
  });

  it('conserva un tema de superhéroe guardado', async () => {
    mockFake.setFirst(() => row('{"theme":"ironman","volume":0.5}'));

    await expect(settingsRepository.get()).resolves.toEqual({
      ...DEFAULT_SETTINGS,
      theme: 'ironman',
      volume: 0.5,
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

    await expect(settingsRepository.get()).resolves.toEqual({ ...DEFAULT_SETTINGS, theme: 'dark', volume: 1 });
    await expect(settingsRepository.get()).resolves.toEqual({ ...DEFAULT_SETTINGS, theme: 'dark', volume: 0 });
    await expect(settingsRepository.get()).resolves.toEqual({ ...DEFAULT_SETTINGS, theme: 'dark', volume: 1 });
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
    expect(JSON.parse(String(write?.params[0]))).toEqual({ ...DEFAULT_SETTINGS, theme: 'light', volume: 0.4 });
  });
});

describe('settingsRepository.setVolume', () => {
  it('conserva el tema y acota el volumen antes de guardar', async () => {
    mockFake.setFirst(() => row('{"theme":"light","volume":0.2}'));

    await settingsRepository.setVolume(3);

    expect(JSON.parse(String(mockFake.last()?.params[0]))).toEqual({
      ...DEFAULT_SETTINGS,
      theme: 'light',
      volume: 1,
    });
  });

  it('guarda cero cuando el volumen es negativo', async () => {
    mockFake.setFirst(() => row('{"theme":"dark","volume":0.8}'));

    await settingsRepository.setVolume(-5);

    expect(JSON.parse(String(mockFake.last()?.params[0]))).toEqual({
      ...DEFAULT_SETTINGS,
      theme: 'dark',
      volume: 0,
    });
  });
});

describe('settingsRepository: idioma y vistas', () => {
  it('migra un JSON antiguo sin idioma ni vistas', async () => {
    mockFake.setFirst(() => row('{"theme":"ironman","volume":0.7}'));

    await expect(settingsRepository.get()).resolves.toEqual({
      ...DEFAULT_SETTINGS,
      theme: 'ironman',
      volume: 0.7,
    });
  });

  it('recupera el idioma y normaliza vistas antiguas/eliminadas', async () => {
    mockFake.setFirst(() =>
      row('{"theme":"dark","volume":1,"language":"en","viewModes":{"albums":"icons","songs":"largeIcons"}}')
    );

    await expect(settingsRepository.get()).resolves.toEqual({
      ...DEFAULT_SETTINGS,
      language: 'en',
      // `icons` equivale a Compacto (4 col); `largeIcons` ya no existe.
      viewModes: { albums: 'compact', songs: 'smallIcons' },
    });
  });

  it('descarta vistas desconocidas sin perder las válidas', async () => {
    mockFake.setFirst(() =>
      row('{"theme":"dark","volume":1,"language":"fr","viewModes":{"albums":"carrusel","songs":"list"}}')
    );

    await expect(settingsRepository.get()).resolves.toEqual({
      ...DEFAULT_SETTINGS,
      viewModes: { songs: 'list' },
    });
  });

  it('setLanguage y setViewMode conservan el resto de ajustes', async () => {
    // El doble simula la lectura-escritura real: cada escritura se convierte
    // en la siguiente fila leída, para comprobar que nada se pierde.
    let stored =
      '{"theme":"light","volume":0.3,"language":"es","viewModes":{"albums":"blocks"}}';
    mockFake.setFirst(() => row(stored));

    await settingsRepository.setLanguage('en');
    stored = String(mockFake.last()?.params[0]);
    await settingsRepository.setViewMode('songs', 'smallIcons');

    expect(JSON.parse(String(mockFake.last()?.params[0]))).toEqual({
      theme: 'light',
      volume: 0.3,
      language: 'en',
      // La preferencia antigua se escribe ya normalizada.
      viewModes: { albums: 'smallIcons', songs: 'smallIcons' },
    });
  });
});
