import Storage from 'expo-sqlite/kv-store';

import { getDatabase } from '@/data/db/database';
import { migrateLegacyLibrary } from '@/services/legacy-migration.service';
import { createFakeDatabase, type FakeDatabase } from '@/testing/mocks/database';

/**
 * Migración del almacén clave-valor antiguo (`FASE 7`).
 *
 * El doble de `expo-sqlite` registra cada sentencia SQL para comprobar qué se
 * importa, y `expo-sqlite/kv-store` se sustituye por un doble controlado. Se
 * comprueba especialmente que la lectura legacy nunca propaga un fallo: los
 * datos corruptos se tratan como si no existieran.
 */

const mockFake = createFakeDatabase();

jest.mock('@/data/db/database', () => ({
  getDatabase: jest.fn(async () => mockFake.db),
}));

jest.mock('expo-sqlite/kv-store', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null) },
}));

const mockedGetItem = jest.mocked(Storage.getItem);
const mockedGetDatabase = jest.mocked(getDatabase);

/** Datos legacy de ejemplo, indexados por la clave del antiguo almacén. */
const LEGACY: Record<string, string> = {
  'library.favorites': JSON.stringify(['m-1', 'm-inexistente']),
  'library.playCounts': JSON.stringify({ 'm-1': 4, 'm-2': 0, 'm-inexistente': 9 }),
  'library.recent': JSON.stringify([{ songId: 'm-1', playedAt: 1_234 }]),
  'library.playlists': JSON.stringify([
    { id: 'p-1', name: 'Mix', songIds: ['m-2', 'm-1', 'm-inexistente'] },
  ]),
};

function setLegacyValues(values: Record<string, string>): void {
  mockedGetItem.mockImplementation(async (key: string) => values[key] ?? null);
}

function setSongs(fake: FakeDatabase): void {
  fake.setAll(() => [
    { id: 1, media_id: 'm-1' },
    { id: 2, media_id: 'm-2' },
  ]);
}

beforeEach(() => {
  mockFake.clear();
  jest.clearAllMocks();
  mockedGetDatabase.mockResolvedValue(
    mockFake.db as unknown as Awaited<ReturnType<typeof getDatabase>>
  );
  mockedGetItem.mockResolvedValue(null);
  mockFake.setFirst(() => null);
  mockFake.setAll(() => []);
});

describe('migrateLegacyLibrary: sin datos', () => {
  it('no importa nada cuando el almacén legacy está vacío', async () => {
    const migrated = await migrateLegacyLibrary();

    expect(migrated).toBe(true);
    // Solo se escribe la marca para no repetir la comprobación en el futuro.
    expect(mockFake.runs).toHaveLength(1);
    expect(mockFake.last()?.sql).toContain('INSERT INTO app_settings');
    expect(mockFake.callsMatching('INSERT INTO favorites')).toHaveLength(0);
    expect(mockFake.callsMatching('INSERT INTO playlists')).toHaveLength(0);
    expect(mockedGetItem).toHaveBeenCalledTimes(4);
  });

  it('no hace nada si ya se migró en una sesión anterior', async () => {
    mockFake.setFirst(() => ({ value: '1_700_000_000_000' }));

    await expect(migrateLegacyLibrary()).resolves.toBe(false);

    expect(mockedGetItem).not.toHaveBeenCalled();
    expect(mockFake.db.withTransactionAsync).not.toHaveBeenCalled();
    expect(mockFake.runs).toHaveLength(0);
  });
});

describe('migrateLegacyLibrary: importación', () => {
  it('importa favorites, conteos, historial y playlists resolviendo ids de mediateca', async () => {
    setLegacyValues(LEGACY);
    setSongs(mockFake);

    await expect(migrateLegacyLibrary()).resolves.toBe(true);

    expect(mockFake.transactions).toHaveLength(1);

    const favorites = mockFake.callsMatching('INSERT OR IGNORE INTO favorites');
    expect(favorites).toHaveLength(1);
    expect(favorites[0].params[0]).toBe(1);

    const counts = mockFake.callsMatching('UPDATE songs SET play_count');
    expect(counts).toHaveLength(1);
    expect(counts[0].params).toEqual([4, 1]);

    const history = mockFake.callsMatching('INSERT INTO playback_history');
    expect(history).toHaveLength(1);
    // `listened_seconds` y `completed` van literales en el SQL, no como parámetros.
    expect(history[0].params).toEqual([1, 1_234]);

    const playlists = mockFake.callsMatching('INSERT INTO playlists');
    expect(playlists).toHaveLength(1);
    expect(playlists[0].params[0]).toBe('Mix');

    const playlistSongs = mockFake.callsMatching('INSERT OR IGNORE INTO playlist_songs');
    // Se omiten los ids que no están en SQLite y se compactan las posiciones.
    expect(playlistSongs.map((call) => call.params.slice(1, 3))).toEqual([
      [2, 0],
      [1, 1],
    ]);
    expect(playlistSongs[0].params[0]).toBe(playlistSongs[1].params[0]);

    expect(mockFake.last()?.sql).toContain('INSERT INTO app_settings');
    expect(mockFake.last()?.params[0]).toBe('legacy_migrated');
  });

  it('es idempotente: la segunda llamada no vuelve a importar', async () => {
    setLegacyValues(LEGACY);
    setSongs(mockFake);
    await expect(migrateLegacyLibrary()).resolves.toBe(true);
    const writes = mockFake.runs.length;

    mockFake.setFirst(() => ({ value: '1_700_000_000_000' }));
    await expect(migrateLegacyLibrary()).resolves.toBe(false);

    expect(mockFake.runs).toHaveLength(writes);
    expect(mockFake.transactions).toHaveLength(1);
  });
});

describe('migrateLegacyLibrary: concurrencia', () => {
  it('comparte una sola transacción entre llamadas simultáneas', async () => {
    setLegacyValues(LEGACY);
    setSongs(mockFake);
    // El doble reproduce el error real de SQLite: si el guard falla, la segunda
    // llamada lanza «cannot start a transaction within a transaction».
    mockFake.setStrictTransactions(true);

    const results = await Promise.all([migrateLegacyLibrary(), migrateLegacyLibrary()]);

    expect(results).toEqual([true, true]);
    // Sin el guard, el check previo a la transacción pasaba en las dos llamadas
    // y la segunda abría una transacción anidada sobre la misma conexión.
    expect(mockFake.db.withTransactionAsync).toHaveBeenCalledTimes(1);
    expect(mockFake.transactions).toHaveLength(1);
    expect(mockFake.callsMatching('INSERT INTO app_settings')).toHaveLength(1);
  });
});

describe('migrateLegacyLibrary: fallos de lectura legacy', () => {
  it('absorbe un rechazo y unos JSON corruptos sin propagar el error', async () => {
    mockedGetItem.mockImplementation(async (key: string) => {
      if (key === 'library.playCounts') {
        throw new Error('kv-store no disponible');
      }
      if (key === 'library.favorites') {
        return 'no es JSON';
      }
      return LEGACY[key] ?? null;
    });
    setSongs(mockFake);

    await expect(migrateLegacyLibrary()).resolves.toBe(true);

    // Se consultaron las cuatro claves: un rechazo no corta el Promise.all.
    expect(mockedGetItem).toHaveBeenCalledTimes(4);
    // Los datos corruptos/ilegibles se descartan; el resto se importa igual.
    expect(mockFake.callsMatching('INSERT OR IGNORE INTO favorites')).toHaveLength(0);
    expect(mockFake.callsMatching('UPDATE songs SET play_count')).toHaveLength(0);
    expect(mockFake.callsMatching('INSERT INTO playback_history')).toHaveLength(1);
    expect(mockFake.callsMatching('INSERT INTO playlists')).toHaveLength(1);
  });
});
