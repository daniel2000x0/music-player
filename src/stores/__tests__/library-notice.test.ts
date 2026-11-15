/**
 * Criterio de salida de FASE 2: un fallo de escaneo debe producir un aviso
 * visible, no solo una fila en `error_logs`.
 *
 * Se sustituyen las dependencias de datos porque la prueba solo verifica la
 * orquestación del store: mediateca fallida → canal de avisos.
 */
import { useLibraryStore } from '@/stores/library.store';
import { useNoticeStore } from '@/stores/notice.store';

jest.mock('@/data/repositories/song.repository', () => ({
  songRepository: {
    getAll: jest.fn(async () => []),
    upsertScannedSongs: jest.fn(),
    reclassifyAudiobooks: jest.fn(),
    getAvailableMediaIds: jest.fn(async () => new Set<string>()),
  },
}));

jest.mock('@/data/repositories/album.repository', () => ({
  albumRepository: { getAll: jest.fn(async () => []) },
}));

jest.mock('@/data/repositories/artist.repository', () => ({
  artistRepository: { getAll: jest.fn(async () => []) },
}));

jest.mock('@/data/repositories/favorite.repository', () => ({
  favoriteRepository: { getIds: jest.fn(async () => []) },
}));

jest.mock('@/data/repositories/history.repository', () => ({
  historyRepository: { getRecent: jest.fn(async () => []) },
}));

jest.mock('@/data/repositories/playlist.repository', () => ({
  playlistRepository: { getAll: jest.fn(async () => []) },
}));

jest.mock('@/data/repositories/maintenance.repository', () => ({
  maintenanceRepository: { clearAdministrativeData: jest.fn() },
}));

jest.mock('@/services/legacy-migration.service', () => ({
  migrateLegacyLibrary: jest.fn(async () => false),
}));

jest.mock('@/services/error-log.service', () => ({
  logError: jest.fn(),
  logWarning: jest.fn(),
}));

jest.mock('@/services/media.service', () => ({
  hasAudioPermission: jest.fn(async () => true),
  requestAudioAccess: jest.fn(async () => false),
  listDeviceAudioIds: jest.fn(async () => null),
  loadDeviceAudio: jest.fn(async () => null),
}));

beforeEach(() => {
  useNoticeStore.getState().clear();
  useLibraryStore.setState({ hasPermission: true, error: null });
});

describe('library.store: fallos visibles en la UI', () => {
  it('publica un aviso cuando la mediateca no se puede leer', async () => {
    await useLibraryStore.getState().refresh();

    const notices = useNoticeStore.getState().notices;
    expect(notices[0]).toMatchObject({
      code: 'library.scan-failed',
      severity: 'error',
      title: 'No se pudo escanear tu música',
      action: { label: 'Reintentar' },
    });
    expect(useLibraryStore.getState().error).toBeTruthy();
  });

  it('publica un aviso cuando el usuario deniega el permiso de audio', async () => {
    await useLibraryStore.getState().requestAccess();

    expect(useNoticeStore.getState().notices[0]).toMatchObject({
      code: 'library.permission-denied',
      severity: 'error',
    });
  });
});
