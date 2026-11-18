/**
 * Criterio de salida de FASE 2: un fallo de escaneo debe producir un aviso
 * visible, no solo una fila en `error_logs`.
 *
 * Se sustituyen las dependencias de datos y el pipeline porque la prueba solo
 * verifica la orquestación del store: mediateca fallida → canal de avisos.
 */
import { runLibraryScan } from '@/services/library-scan.service';
import { useLibraryStore } from '@/stores/library.store';
import { useNoticeStore } from '@/stores/notice.store';

jest.mock('@/data/repositories/song.repository', () => ({
  songRepository: {
    getAll: jest.fn(async () => []),
    setAudiobook: jest.fn(),
    countIgnored: jest.fn(async () => 0),
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
}));

jest.mock('@/services/library-scan.service', () => ({
  runLibraryScan: jest.fn(async () => null),
}));

const mockedRunLibraryScan = jest.mocked(runLibraryScan);

beforeEach(() => {
  useNoticeStore.getState().clear();
  useLibraryStore.setState({
    hasPermission: true,
    error: null,
    scanProgress: null,
    lastScanReport: null,
  });
  jest.clearAllMocks();
});

describe('library.store: fallos visibles en la UI', () => {
  it('publica un aviso cuando la mediateca no se puede leer', async () => {
    mockedRunLibraryScan.mockResolvedValueOnce(null);

    await useLibraryStore.getState().refresh();

    const notices = useNoticeStore.getState().notices;
    expect(notices[0]).toMatchObject({
      code: 'library.scan-failed',
      severity: 'error',
      title: 'No se pudo escanear tu música',
      action: { label: 'Reintentar' },
    });
    expect(useLibraryStore.getState().error).toBeTruthy();
    expect(useLibraryStore.getState().scanProgress).toBeNull();
  });

  it('publica un aviso cuando el usuario deniega el permiso de audio', async () => {
    await useLibraryStore.getState().requestAccess();

    expect(useNoticeStore.getState().notices[0]).toMatchObject({
      code: 'library.permission-denied',
      severity: 'error',
    });
  });

  it('guarda el resumen del escaneo y limpia el progreso al terminar', async () => {
    mockedRunLibraryScan.mockImplementationOnce(async (onProgress) => {
      onProgress?.({ phase: 'enumerate', processed: 0, total: 0 });
      onProgress?.({ phase: 'done', processed: 3, total: 3, mode: 'incremental' });
      return {
        mode: 'incremental',
        deviceTotal: 3,
        added: 2,
        updated: 0,
        unchanged: 1,
        missing: 0,
        skipped: 0,
        durationMs: 1_500,
        finishedAt: 10,
      };
    });

    await useLibraryStore.getState().refresh();

    expect(useLibraryStore.getState().lastScanReport).toMatchObject({
      added: 2,
      unchanged: 1,
    });
    expect(useLibraryStore.getState().scanProgress).toBeNull();
    expect(useLibraryStore.getState().error).toBeNull();
  });
});
