import type { ScanReport } from '@/domain/library/scan-report';
import { makeSong } from '@/testing/fixtures';
import type { Album } from '@/types/song';
import type { Playlist } from '@/types/playlist';

/**
 * Pruebas de orquestación del store de biblioteca (`FASE 7`).
 *
 * LÓGICA: el store combina permisos, escaneo, migración y repositorios SQLite.
 * Se sustituyen todos para decidir en cada prueba si el escaneo termina, si hay
 * cambios o si la mediateca falla, sin tocar la base de datos. `hydratePromise`
 * y `scanPromise` son estado de módulo, así que se recargan los módulos en cada
 * prueba con `jest.resetModules()` y se vuelven a requerir.
 */
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { appOwnership: null, executionEnvironment: 'bare' },
}));

jest.mock('@/data/repositories/album.repository', () => ({
  albumRepository: { getAll: jest.fn(async () => []) },
}));

jest.mock('@/data/repositories/artist.repository', () => ({
  artistRepository: { getAll: jest.fn(async () => []) },
}));

jest.mock('@/data/repositories/favorite.repository', () => ({
  favoriteRepository: {
    getIds: jest.fn(async () => []),
    toggle: jest.fn(async () => undefined),
  },
}));

jest.mock('@/data/repositories/history.repository', () => ({
  historyRepository: {
    getRecent: jest.fn(async () => []),
    record: jest.fn(async () => undefined),
    clear: jest.fn(async () => undefined),
  },
}));

jest.mock('@/data/repositories/maintenance.repository', () => ({
  maintenanceRepository: { clearAdministrativeData: jest.fn(async () => undefined) },
}));

jest.mock('@/data/repositories/playlist.repository', () => ({
  playlistRepository: {
    getAll: jest.fn(async () => []),
    create: jest.fn(async () => null),
    rename: jest.fn(async () => undefined),
    remove: jest.fn(async () => undefined),
    addSong: jest.fn(async () => undefined),
    removeSong: jest.fn(async () => undefined),
    moveSong: jest.fn(async () => undefined),
  },
}));

jest.mock('@/data/repositories/song.repository', () => ({
  songRepository: {
    getAll: jest.fn(async () => []),
    countIgnored: jest.fn(async () => 0),
    setAudiobook: jest.fn(async () => undefined),
    updateSongMetadata: jest.fn(async () => undefined),
    renameAlbum: jest.fn(async () => undefined),
    removeFromLibrary: jest.fn(async () => undefined),
    markUnavailable: jest.fn(async () => undefined),
    restoreIgnored: jest.fn(async () => undefined),
  },
}));

jest.mock('@/services/artwork-backfill.service', () => ({
  runArtworkBackfill: jest.fn(async () => ({
    candidates: 0,
    resolved: 0,
    albums: 0,
    durationMs: 0,
  })),
}));

jest.mock('@/services/capabilities', () => ({
  setPermissionSnapshot: jest.fn(),
  getCapabilities: jest.fn(() => ({})),
  subscribeCapabilities: jest.fn(() => () => undefined),
}));

jest.mock('@/services/error-log.service', () => ({
  logError: jest.fn(),
  logWarning: jest.fn(),
}));

jest.mock('@/services/legacy-migration.service', () => ({
  migrateLegacyLibrary: jest.fn(async () => false),
}));

jest.mock('@/services/library-scan.service', () => ({
  runLibraryScan: jest.fn(async () => null),
}));

jest.mock('@/services/media.service', () => ({
  hasAudioPermission: jest.fn(async () => true),
  requestAudioAccess: jest.fn(async () => false),
  deleteDeviceAssets: jest.fn(async () => ({ deleted: 0 })),
}));

type Loaded = {
  library: typeof import('@/stores/library.store');
  notice: typeof import('@/stores/notice.store');
  songRepo: typeof import('@/data/repositories/song.repository');
  albumRepo: typeof import('@/data/repositories/album.repository');
  artistRepo: typeof import('@/data/repositories/artist.repository');
  favoriteRepo: typeof import('@/data/repositories/favorite.repository');
  historyRepo: typeof import('@/data/repositories/history.repository');
  playlistRepo: typeof import('@/data/repositories/playlist.repository');
  maintenanceRepo: typeof import('@/data/repositories/maintenance.repository');
  scan: typeof import('@/services/library-scan.service');
  backfill: typeof import('@/services/artwork-backfill.service');
  media: typeof import('@/services/media.service');
  migration: typeof import('@/services/legacy-migration.service');
  capabilities: typeof import('@/services/capabilities');
};

function loadModules(): Loaded {
  return {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    library: require('@/stores/library.store'),
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    notice: require('@/stores/notice.store'),
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    songRepo: require('@/data/repositories/song.repository'),
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    albumRepo: require('@/data/repositories/album.repository'),
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    artistRepo: require('@/data/repositories/artist.repository'),
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    favoriteRepo: require('@/data/repositories/favorite.repository'),
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    historyRepo: require('@/data/repositories/history.repository'),
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    playlistRepo: require('@/data/repositories/playlist.repository'),
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    maintenanceRepo: require('@/data/repositories/maintenance.repository'),
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    scan: require('@/services/library-scan.service'),
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    backfill: require('@/services/artwork-backfill.service'),
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    media: require('@/services/media.service'),
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    migration: require('@/services/legacy-migration.service'),
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    capabilities: require('@/services/capabilities'),
  };
}

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

/** Promesa controlada para probar la deduplicación de escaneos en vuelo. */
function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function report(overrides: Partial<ScanReport> = {}): ScanReport {
  return {
    mode: 'incremental',
    deviceTotal: 3,
    added: 0,
    updated: 0,
    unchanged: 3,
    missing: 0,
    skipped: 0,
    durationMs: 1_500,
    finishedAt: 10,
    ...overrides,
  };
}

function playlist(overrides: Partial<Playlist> = {}): Playlist {
  return {
    id: 1,
    name: 'Favoritas',
    isAuto: false,
    autoKey: null,
    songIds: [],
    createdAt: 100,
    updatedAt: 100,
    ...overrides,
  };
}

function album(overrides: Partial<Album> = {}): Album {
  return {
    id: 1,
    title: 'Álbum',
    artist: 'Artista',
    artwork: null,
    songCount: 1,
    totalDuration: 180,
    createdAt: 100,
    ...overrides,
  };
}

let modules: Loaded;

function library() {
  return modules.library.useLibraryStore;
}

beforeEach(() => {
  jest.resetModules();
  modules = loadModules();
  modules.notice.useNoticeStore.getState().clear();
});

afterEach(() => {
  jest.clearAllTimers();
});

describe('library.store: hydrate', () => {
  it('mantiene el loader en la primera ejecución (BD vacía) sin esperar el escaneo', async () => {
    // La segunda consulta de permiso queda pendiente: simula la sincronización
    // en segundo plano todavía en curso tras la hidratación.
    jest
      .mocked(modules.media.hasAudioPermission)
      .mockResolvedValueOnce(true)
      .mockReturnValueOnce(new Promise(() => undefined));
    jest.mocked(modules.songRepo.songRepository.getAll).mockResolvedValueOnce([]);

    await library().getState().hydrate();

    expect(library().getState()).toMatchObject({
      hasPermission: true,
      hydrated: true,
      isLoading: true,
      songs: [],
      error: null,
    });
    expect(modules.capabilities.setPermissionSnapshot).toHaveBeenCalledWith({
      mediaLibrary: true,
    });
    expect(modules.scan.runLibraryScan).not.toHaveBeenCalled();
  });

  it('sin permiso no sincroniza y baja el loader', async () => {
    jest.mocked(modules.media.hasAudioPermission).mockResolvedValue(false);
    jest
      .mocked(modules.songRepo.songRepository.getAll)
      .mockResolvedValueOnce([makeSong({ id: 1 })]);

    await library().getState().hydrate();

    expect(library().getState()).toMatchObject({
      hasPermission: false,
      hydrated: true,
      isLoading: false,
      songs: [makeSong({ id: 1 })],
    });
    expect(modules.scan.runLibraryScan).not.toHaveBeenCalled();
  });

  it('publica un aviso y deja de cargar si falla la copia local', async () => {
    jest.mocked(modules.media.hasAudioPermission).mockResolvedValue(false);
    jest
      .mocked(modules.songRepo.songRepository.getAll)
      .mockRejectedValueOnce(new Error('BD no disponible'));

    await library().getState().hydrate();

    expect(library().getState()).toMatchObject({
      hydrated: true,
      isLoading: false,
      error: 'BD no disponible',
    });
    expect(modules.notice.useNoticeStore.getState().notices[0]).toMatchObject({
      code: 'library.load-failed',
      severity: 'error',
    });
  });

  it('deduplica hidrataciones concurrentes', async () => {
    jest.mocked(modules.media.hasAudioPermission).mockResolvedValue(true);

    await Promise.all([library().getState().hydrate(), library().getState().hydrate()]);

    expect(modules.songRepo.songRepository.getAll).toHaveBeenCalledTimes(1);
    expect(library().getState().hydrated).toBe(true);
  });
});

describe('library.store: scanOnce', () => {
  it('comparte la promesa en vuelo y guarda el resumen al terminar', async () => {
    const gate = deferred<ScanReport | null>();
    const result = report({ added: 2, unchanged: 1 });
    jest.mocked(modules.scan.runLibraryScan).mockReturnValueOnce(gate.promise);

    const first = library().getState().scanOnce();
    const second = library().getState().scanOnce();

    // Solo una pasada aunque dos acciones pidieran el escaneo a la vez.
    expect(modules.scan.runLibraryScan).toHaveBeenCalledTimes(1);
    expect(library().getState().scanProgress).toEqual({
      phase: 'enumerate',
      processed: 0,
      total: 0,
    });

    gate.resolve(result);
    await expect(Promise.all([first, second])).resolves.toEqual([result, result]);

    expect(library().getState().lastScanReport).toEqual(result);
    expect(library().getState().scanProgress).toBeNull();
  });

  it('publica el progreso de cada fase y limpia al terminar', async () => {
    const seen: unknown[] = [];
    jest.mocked(modules.scan.runLibraryScan).mockImplementationOnce(async (onProgress) => {
      onProgress?.({ phase: 'diff', processed: 1, total: 2 });
      seen.push(library().getState().scanProgress);
      onProgress?.({ phase: 'done', processed: 2, total: 2 });
      seen.push(library().getState().scanProgress);
      return report();
    });

    await library().getState().scanOnce();

    expect(seen).toEqual([
      { phase: 'diff', processed: 1, total: 2 },
      { phase: 'done', processed: 2, total: 2 },
    ]);
    expect(library().getState().scanProgress).toBeNull();
  });
});

describe('library.store: refresh', () => {
  it('sin permiso no escanea pero recarga la biblioteca local', async () => {
    jest.mocked(modules.media.hasAudioPermission).mockResolvedValue(false);
    jest
      .mocked(modules.songRepo.songRepository.getAll)
      .mockResolvedValueOnce([makeSong({ id: 1 })]);

    await library().getState().refresh();

    expect(modules.scan.runLibraryScan).not.toHaveBeenCalled();
    expect(modules.songRepo.songRepository.getAll).toHaveBeenCalledTimes(1);
    expect(library().getState()).toMatchObject({
      hasPermission: false,
      isLoading: false,
      isScanning: false,
      songs: [makeSong({ id: 1 })],
    });
  });

  it('si la mediateca falla avisa y no migran datos', async () => {
    jest.mocked(modules.media.hasAudioPermission).mockResolvedValue(true);
    jest.mocked(modules.scan.runLibraryScan).mockResolvedValueOnce(null);

    await library().getState().refresh();

    expect(modules.migration.migrateLegacyLibrary).not.toHaveBeenCalled();
    expect(modules.notice.useNoticeStore.getState().notices[0]).toMatchObject({
      code: 'library.scan-failed',
      severity: 'error',
      action: { label: 'Reintentar' },
    });
    expect(library().getState().error).toBeTruthy();
    expect(library().getState().isScanning).toBe(false);
  });

  it('con éxito migra, limpia el aviso anterior y recarga', async () => {
    jest.mocked(modules.media.hasAudioPermission).mockResolvedValue(true);
    jest.mocked(modules.scan.runLibraryScan).mockResolvedValueOnce(report({ added: 1 }));
    modules.notice.useNoticeStore.getState().push({
      code: 'library.scan-failed',
      severity: 'error',
      title: 'Fallo anterior',
    });

    await library().getState().refresh();

    expect(modules.migration.migrateLegacyLibrary).toHaveBeenCalledTimes(1);
    expect(modules.notice.useNoticeStore.getState().notices).toEqual([]);
    expect(library().getState()).toMatchObject({ isLoading: false, error: null });
    expect(library().getState().lastScanReport?.added).toBe(1);
  });

  it('no inicia un segundo escaneo si ya hay uno en curso', async () => {
    library().setState({ isScanning: true });

    await library().getState().refresh();

    expect(modules.media.hasAudioPermission).not.toHaveBeenCalled();
    expect(modules.scan.runLibraryScan).not.toHaveBeenCalled();
  });

  it('publica un aviso si el escaneo lanza una excepción', async () => {
    jest.mocked(modules.media.hasAudioPermission).mockResolvedValue(true);
    jest.mocked(modules.scan.runLibraryScan).mockRejectedValueOnce(new Error('SQLite ocupada'));

    await library().getState().refresh();

    expect(library().getState().error).toBe('SQLite ocupada');
    expect(modules.notice.useNoticeStore.getState().notices[0]).toMatchObject({
      code: 'library.scan-failed',
    });
    expect(library().getState().isScanning).toBe(false);
  });
});

describe('library.store: sync', () => {
  it('sin cambios no repite las consultas de loadLocal', async () => {
    jest.mocked(modules.media.hasAudioPermission).mockResolvedValue(true);
    jest.mocked(modules.scan.runLibraryScan).mockResolvedValueOnce(report());

    await library().getState().sync();

    expect(modules.songRepo.songRepository.getAll).not.toHaveBeenCalled();
    expect(modules.migration.migrateLegacyLibrary).not.toHaveBeenCalled();
    expect(library().getState().isLoading).toBe(false);
    expect(library().getState().isSyncing).toBe(false);
  });

  it('con cambios migran y recarga la biblioteca', async () => {
    const songs = [makeSong({ id: 4 })];
    jest.mocked(modules.media.hasAudioPermission).mockResolvedValue(true);
    jest.mocked(modules.scan.runLibraryScan).mockResolvedValueOnce(report({ added: 1 }));
    jest.mocked(modules.songRepo.songRepository.getAll).mockResolvedValue(songs);

    await library().getState().sync();

    expect(modules.migration.migrateLegacyLibrary).toHaveBeenCalledTimes(1);
    expect(modules.songRepo.songRepository.getAll).toHaveBeenCalled();
    expect(library().getState().songs).toEqual(songs);
    expect(library().getState().isLoading).toBe(false);
  });

  it('publica un aviso de sincronización si falla', async () => {
    jest.mocked(modules.media.hasAudioPermission).mockResolvedValue(true);
    jest
      .mocked(modules.scan.runLibraryScan)
      .mockRejectedValueOnce(new Error('No se pudo sincronizar'));

    await library().getState().sync();

    expect(modules.notice.useNoticeStore.getState().notices[0]).toMatchObject({
      code: 'library.sync-failed',
      severity: 'error',
    });
    expect(library().getState().isSyncing).toBe(false);
  });

  it('no solapa dos sincronizaciones', async () => {
    library().setState({ isSyncing: true });

    await library().getState().sync();

    expect(modules.media.hasAudioPermission).not.toHaveBeenCalled();
  });
});

describe('library.store: requestAccess', () => {
  it('con permiso denegado avisa y no escanea', async () => {
    jest.mocked(modules.media.requestAudioAccess).mockResolvedValue(false);

    await library().getState().requestAccess();

    expect(modules.notice.useNoticeStore.getState().notices[0]).toMatchObject({
      code: 'library.permission-denied',
      severity: 'error',
    });
    expect(modules.scan.runLibraryScan).not.toHaveBeenCalled();
    expect(library().getState()).toMatchObject({ hasPermission: false, isLoading: false });
  });

  it('con permiso concedido limpia el aviso y refresca', async () => {
    jest.mocked(modules.media.requestAudioAccess).mockResolvedValue(true);
    jest.mocked(modules.media.hasAudioPermission).mockResolvedValue(true);
    // El refresco termina bien: no debe aparecer un aviso de escaneo fallido.
    jest.mocked(modules.scan.runLibraryScan).mockResolvedValueOnce(report());
    modules.notice.useNoticeStore.getState().push({
      code: 'library.permission-denied',
      severity: 'error',
      title: 'Permiso denegado',
    });

    await library().getState().requestAccess();

    expect(modules.notice.useNoticeStore.getState().notices).toEqual([]);
    expect(modules.scan.runLibraryScan).toHaveBeenCalledTimes(1);
    expect(library().getState().hasPermission).toBe(true);
  });
});

describe('library.store: favoritos y playlists', () => {
  it('toggleFavorite actualiza los ids e isFavorite los consulta', async () => {
    jest.mocked(modules.favoriteRepo.favoriteRepository.getIds).mockResolvedValue([1]);

    await library().getState().toggleFavorite(1);

    expect(modules.favoriteRepo.favoriteRepository.toggle).toHaveBeenCalledWith(1);
    expect(library().getState().favoriteIds).toEqual([1]);
    expect(library().getState().isFavorite(1)).toBe(true);
    expect(library().getState().isFavorite(2)).toBe(false);
  });

  it('createPlaylist devuelve la playlist creada y recarga el listado', async () => {
    const created = playlist();
    jest.mocked(modules.playlistRepo.playlistRepository.create).mockResolvedValue(created);
    jest.mocked(modules.playlistRepo.playlistRepository.getAll).mockResolvedValue([created]);

    await expect(library().getState().createPlaylist('Favoritas')).resolves.toEqual(created);

    expect(modules.playlistRepo.playlistRepository.create).toHaveBeenCalledWith('Favoritas');
    expect(library().getState().playlists).toEqual([created]);
  });

  it('renamePlaylist llama al repositorio y recarga', async () => {
    const renamed = playlist({ name: 'Nueva' });
    jest.mocked(modules.playlistRepo.playlistRepository.getAll).mockResolvedValue([renamed]);

    await library().getState().renamePlaylist(1, 'Nueva');

    expect(modules.playlistRepo.playlistRepository.rename).toHaveBeenCalledWith(1, 'Nueva');
    expect(library().getState().playlists).toEqual([renamed]);
  });

  it('deletePlaylist llama al repositorio y recarga', async () => {
    await library().getState().deletePlaylist(3);

    expect(modules.playlistRepo.playlistRepository.remove).toHaveBeenCalledWith(3);
    expect(modules.playlistRepo.playlistRepository.getAll).toHaveBeenCalled();
  });

  it('addToPlaylist y removeFromPlaylist delegan los ids', async () => {
    await library().getState().addToPlaylist(2, 5);
    await library().getState().removeFromPlaylist(2, 5);

    expect(modules.playlistRepo.playlistRepository.addSong).toHaveBeenCalledWith(2, 5);
    expect(modules.playlistRepo.playlistRepository.removeSong).toHaveBeenCalledWith(2, 5);
    expect(modules.playlistRepo.playlistRepository.getAll).toHaveBeenCalledTimes(2);
  });

  it('movePlaylistSong delega la dirección', async () => {
    await library().getState().movePlaylistSong(2, 5, 'up');

    expect(modules.playlistRepo.playlistRepository.moveSong).toHaveBeenCalledWith(2, 5, 'up');
    expect(modules.playlistRepo.playlistRepository.getAll).toHaveBeenCalledTimes(1);
  });
});

describe('library.store: edición de la biblioteca', () => {
  it('clearHistory limpia recientes y recarga las canciones', async () => {
    const songs = [makeSong({ id: 1 })];
    library().setState({ recentIds: [1, 2] });
    jest.mocked(modules.songRepo.songRepository.getAll).mockResolvedValue(songs);

    await library().getState().clearHistory();

    expect(modules.historyRepo.historyRepository.clear).toHaveBeenCalledTimes(1);
    expect(library().getState().recentIds).toEqual([]);
    expect(library().getState().songs).toEqual(songs);
  });

  it('setAudiobook delega los ids y recarga las canciones', async () => {
    const songs = [makeSong({ id: 1, isAudiobook: true })];
    jest.mocked(modules.songRepo.songRepository.getAll).mockResolvedValue(songs);

    await library().getState().setAudiobook([1], true);

    expect(modules.songRepo.songRepository.setAudiobook).toHaveBeenCalledWith([1], true);
    expect(library().getState().songs).toEqual(songs);
  });

  it('updateSongMetadata recarga canciones, álbumes y artistas', async () => {
    jest.mocked(modules.songRepo.songRepository.getAll).mockResolvedValue([makeSong({ id: 1 })]);
    jest.mocked(modules.albumRepo.albumRepository.getAll).mockResolvedValue([album()]);

    await library().getState().updateSongMetadata(1, { title: 'Nuevo título' });

    expect(modules.songRepo.songRepository.updateSongMetadata).toHaveBeenCalledWith(1, {
      title: 'Nuevo título',
    });
    expect(modules.albumRepo.albumRepository.getAll).toHaveBeenCalledTimes(1);
    expect(modules.artistRepo.artistRepository.getAll).toHaveBeenCalledTimes(1);
    // Las playlists no dependen de los metadatos: no se recargan.
    expect(modules.playlistRepo.playlistRepository.getAll).not.toHaveBeenCalled();
  });

  it('renameAlbum recarga los agregados derivados', async () => {
    await library().getState().renameAlbum(4, 'Otro álbum');

    expect(modules.songRepo.songRepository.renameAlbum).toHaveBeenCalledWith(4, 'Otro álbum');
    expect(modules.albumRepo.albumRepository.getAll).toHaveBeenCalledTimes(1);
    expect(modules.artistRepo.artistRepository.getAll).toHaveBeenCalledTimes(1);
  });

  it('removeSongs con lista vacía no toca el repositorio', async () => {
    await library().getState().removeSongs([]);

    expect(modules.songRepo.songRepository.removeFromLibrary).not.toHaveBeenCalled();
  });

  it('removeSongs quita las pistas sin borrar el archivo y recarga', async () => {
    await library().getState().removeSongs([1, 2]);

    expect(modules.songRepo.songRepository.removeFromLibrary).toHaveBeenCalledWith([1, 2]);
    expect(modules.songRepo.songRepository.getAll).toHaveBeenCalled();
  });

  it('deleteSongsFromDevice no llama al sistema si no hay pistas conocidas', async () => {
    library().setState({ songs: [makeSong({ id: 1, mediaId: 'media-1' })] });

    const result = await library().getState().deleteSongsFromDevice([99]);

    expect(result).toEqual({ deleted: 0 });
    expect(modules.media.deleteDeviceAssets).not.toHaveBeenCalled();
  });

  it('deleteSongsFromDevice conserva la biblioteca si el sistema no confirmó el borrado', async () => {
    const songs = [makeSong({ id: 1, mediaId: 'media-1' })];
    library().setState({ songs });
    jest.mocked(modules.media.deleteDeviceAssets).mockResolvedValue({ deleted: 0 });

    const result = await library().getState().deleteSongsFromDevice([1]);

    expect(result.deleted).toBe(0);
    expect(modules.media.deleteDeviceAssets).toHaveBeenCalledWith(['media-1']);
    expect(modules.songRepo.songRepository.markUnavailable).not.toHaveBeenCalled();
    expect(library().getState().songs).toEqual(songs);
  });

  it('deleteSongsFromDevice retira solo las pistas confirmadas', async () => {
    const songs = [makeSong({ id: 1, mediaId: 'media-1' })];
    library().setState({ songs });
    jest.mocked(modules.media.deleteDeviceAssets).mockResolvedValue({ deleted: 1 });

    const result = await library().getState().deleteSongsFromDevice([1]);

    expect(result.deleted).toBe(1);
    expect(modules.songRepo.songRepository.markUnavailable).toHaveBeenCalledWith([1]);
    expect(modules.songRepo.songRepository.getAll).toHaveBeenCalled();
  });

  it('restoreHiddenSongs olvida el filtro, recarga y lanza un escaneo', async () => {
    jest.mocked(modules.media.hasAudioPermission).mockResolvedValue(true);

    await library().getState().restoreHiddenSongs();

    expect(modules.songRepo.songRepository.restoreIgnored).toHaveBeenCalledTimes(1);
    expect(modules.songRepo.songRepository.getAll).toHaveBeenCalled();
    expect(modules.scan.runLibraryScan).toHaveBeenCalledTimes(1);
  });
});

describe('library.store: getters y contadores locales', () => {
  it('resuelve canciones por id y por id de mediateca', () => {
    const first = makeSong({ id: 1, mediaId: 'media-1' });
    const second = makeSong({ id: 2, mediaId: 'media-2' });
    library().setState({ songs: [first, second] });

    expect(library().getState().getSongById(2)).toEqual(second);
    expect(library().getState().getSongById(9)).toBeUndefined();
    expect(library().getState().getSongByIdOrMedia(1)).toEqual(first);
    expect(library().getState().getSongByIdOrMedia('media-2')).toEqual(second);
    expect(library().getState().getSongByIdOrMedia('media-9')).toBeUndefined();
  });

  it('getSongsByIds respeta el orden y descarta ids ausentes', () => {
    const first = makeSong({ id: 1 });
    const second = makeSong({ id: 2 });
    library().setState({ songs: [first, second] });

    expect(library().getState().getSongsByIds([2, 99, 1])).toEqual([second, first]);
  });

  it('getSongsByAlbum usa la identidad título + artista del álbum', () => {
    const first = makeSong({ id: 1, album: 'Disco', artist: 'Artista' });
    const second = makeSong({ id: 2, album: 'Disco', artist: 'Otro' });
    library().setState({
      songs: [first, second],
      albums: [album({ id: 3, title: 'Disco', artist: 'Artista' })],
    });

    expect(library().getState().getSongsByAlbum(3)).toEqual([first]);
    expect(library().getState().getSongsByAlbum(99)).toEqual([]);
  });

  it('getSongsByArtist filtra por el nombre del artista', () => {
    const first = makeSong({ id: 1, artist: 'Artista' });
    const second = makeSong({ id: 2, artist: 'Otro' });
    library().setState({ songs: [first, second] });

    expect(library().getState().getSongsByArtist('Artista')).toEqual([first]);
  });

  it('recordPlayLocal incrementa el contador y coloca la pista primero en recientes', () => {
    const first = makeSong({ id: 1, playCount: 2, lastPlayedAt: null });
    const second = makeSong({ id: 2, playCount: 0 });
    library().setState({ songs: [first, second], recentIds: [2, 1, 3] });

    library().getState().recordPlayLocal(1, 9_999);

    expect(library().getState().songs[0]).toMatchObject({
      playCount: 3,
      lastPlayedAt: 9_999,
    });
    expect(library().getState().songs[1].playCount).toBe(0);
    expect(library().getState().recentIds).toEqual([1, 2, 3]);
  });

  it('recordPlayLocal limita el historial local a 50 entradas', () => {
    const songs = Array.from({ length: 55 }, (_, index) =>
      makeSong({ id: index + 1, mediaId: `media-${index + 1}` })
    );
    library().setState({ songs, recentIds: [] });

    for (let id = 1; id <= 55; id += 1) {
      library().getState().recordPlayLocal(id, id);
    }

    expect(library().getState().recentIds).toHaveLength(50);
    expect(library().getState().recentIds[0]).toBe(55);
  });
});
