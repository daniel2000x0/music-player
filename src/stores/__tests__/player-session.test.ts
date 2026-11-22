import { makeSong } from '@/testing/fixtures';
import type { Song } from '@/types/song';

/**
 * Criterio de salida de FASE 4: restaurar la sesión deja la cola filtrada y
 * **en pausa**, nunca reproduce sola (`A-01`).
 *
 * LÓGICA: se sustituyen los repositorios y la fachada del motor porque la
 * prueba solo verifica la orquestación de `hydrateSession`: qué se restaura,
 * qué se filtra y qué NO se arranca. El estado del módulo (`sessionHydrated`)
 * es global, así que cada prueba recarga los módulos con `resetModules`.
 */
jest.mock('@/data/repositories/history.repository', () => ({
  historyRepository: { record: jest.fn(async () => undefined) },
}));

jest.mock('@/data/repositories/playback-session.repository', () => ({
  playbackSessionRepository: {
    load: jest.fn(async () => null),
    save: jest.fn(async () => undefined),
    clear: jest.fn(async () => undefined),
  },
}));

jest.mock('@/data/repositories/settings.repository', () => ({
  settingsRepository: {
    get: jest.fn(async () => ({ theme: 'dark', volume: 1, language: 'es', viewModes: {} })),
    setVolume: jest.fn(async () => undefined),
  },
}));

jest.mock('@/services/audio', () => ({
  appendSong: jest.fn(),
  getCurrentIndex: jest.fn(() => 0),
  getTrackCount: jest.fn(() => 0),
  hasQueue: jest.fn(() => false),
  insertAfterCurrent: jest.fn(),
  maintainWindow: jest.fn(),
  nextTrack: jest.fn(),
  pause: jest.fn(),
  previousTrack: jest.fn(),
  rebuildQueue: jest.fn(),
  removeSongById: jest.fn(),
  seekTo: jest.fn(),
  setLoop: jest.fn(),
  setVolume: jest.fn(),
  startQueue: jest.fn(),
  stopPlayback: jest.fn(),
  togglePlayback: jest.fn(),
}));

jest.mock('@/services/audio/session-persistence', () => ({
  flushSessionPersistence: jest.fn(async () => undefined),
  savePositionThrottled: jest.fn(),
  saveSessionNow: jest.fn(),
  saveSessionSoon: jest.fn(),
}));

jest.mock('@/services/error-log.service', () => ({
  logError: jest.fn(),
  logWarning: jest.fn(),
}));

jest.mock('@/stores/library.store', () => {
  const state: { songs: Song[]; recordPlayLocal: jest.Mock } = {
    songs: [],
    recordPlayLocal: jest.fn(),
  };
  return {
    useLibraryStore: {
      getState: () => state,
      __state: state,
    },
  };
});

type Loaded = {
  playerStore: typeof import('@/stores/player.store');
  sessionRepo: typeof import('@/data/repositories/playback-session.repository');
  settingsRepo: typeof import('@/data/repositories/settings.repository');
  audio: typeof import('@/services/audio');
  library: typeof import('@/stores/library.store');
  notice: typeof import('@/stores/notice.store');
  progress: typeof import('@/stores/playback-progress');
};

function loadModules(): Loaded {
  return {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    playerStore: require('@/stores/player.store'),
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    sessionRepo: require('@/data/repositories/playback-session.repository'),
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    settingsRepo: require('@/data/repositories/settings.repository'),
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    audio: require('@/services/audio'),
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    library: require('@/stores/library.store'),
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    notice: require('@/stores/notice.store'),
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    progress: require('@/stores/playback-progress'),
  };
}

/** El mock de `library.store` expone su estado mutable en `__state`. */
function setLibrarySongs(modules: Loaded, songs: Song[]): void {
  (
    modules.library.useLibraryStore as unknown as { __state: { songs: Song[] } }
  ).__state.songs = songs;
}

beforeEach(() => {
  jest.resetModules();
});

describe('player.store: hydrateSession restaura sin auto-play', () => {
  it('filtra 3 ausentes de una cola de 500 y deja 497 en pausa', async () => {
    const modules = loadModules();
    const songs: Song[] = [];
    for (let id = 1; id <= 497; id += 1) {
      songs.push(makeSong({ id, title: `Pista ${id}`, duration: 200 }));
    }
    setLibrarySongs(modules, songs);

    const savedQueue = [];
    for (let id = 1; id <= 500; id += 1) {
      savedQueue.push(id);
    }
    jest.mocked(modules.sessionRepo.playbackSessionRepository.load).mockResolvedValueOnce({
      queueSongIds: savedQueue,
      currentSongId: 250,
      positionSeconds: 42,
      repeatMode: 'all',
      shuffle: false,
      updatedAt: 1,
    });

    await modules.playerStore.usePlayerStore.getState().hydrateSession();

    const state = modules.playerStore.usePlayerStore.getState();
    expect(state.queue).toHaveLength(497);
    expect(state.currentSong?.id).toBe(250);
    expect(state.repeatMode).toBe('all');
    expect(state.isPlaying).toBe(false);
    expect(modules.progress.getPlaybackPosition()).toBe(42);
    expect(modules.notice.useNoticeStore.getState().notices[0]).toMatchObject({
      code: 'player.session-restored',
      severity: 'info',
    });
  });

  it('no crea la playlist ni arranca la reproducción al restaurar', async () => {
    const modules = loadModules();
    setLibrarySongs(modules, [makeSong({ id: 1 })]);
    jest.mocked(modules.sessionRepo.playbackSessionRepository.load).mockResolvedValueOnce({
      queueSongIds: [1],
      currentSongId: 1,
      positionSeconds: 10,
      repeatMode: 'none',
      shuffle: false,
      updatedAt: 1,
    });

    await modules.playerStore.usePlayerStore.getState().hydrateSession();

    expect(modules.audio.rebuildQueue).not.toHaveBeenCalled();
    expect(modules.audio.startQueue).not.toHaveBeenCalled();
  });

  it('aplica el volumen guardado al motor', async () => {
    const modules = loadModules();
    jest.mocked(modules.settingsRepo.settingsRepository.get).mockResolvedValueOnce({
      theme: 'dark',
      volume: 0.3,
      language: 'es',
      viewModes: {},
    });

    await modules.playerStore.usePlayerStore.getState().hydrateSession();

    expect(modules.audio.setVolume).toHaveBeenCalledWith(0.3);
    expect(modules.playerStore.usePlayerStore.getState().volume).toBe(0.3);
  });

  it('no borra la sesión guardada si la biblioteca aún está vacía', async () => {
    const modules = loadModules();
    setLibrarySongs(modules, []);
    jest.mocked(modules.sessionRepo.playbackSessionRepository.load).mockResolvedValueOnce({
      queueSongIds: [1, 2],
      currentSongId: 1,
      positionSeconds: 0,
      repeatMode: 'none',
      shuffle: false,
      updatedAt: 1,
    });

    await modules.playerStore.usePlayerStore.getState().hydrateSession();

    expect(modules.sessionRepo.playbackSessionRepository.clear).not.toHaveBeenCalled();
  });

  it('limpia la fila cuando ninguna pista de la cola sobrevive', async () => {
    const modules = loadModules();
    setLibrarySongs(modules, [makeSong({ id: 99 })]);
    jest.mocked(modules.sessionRepo.playbackSessionRepository.load).mockResolvedValueOnce({
      queueSongIds: [1, 2],
      currentSongId: 1,
      positionSeconds: 0,
      repeatMode: 'none',
      shuffle: false,
      updatedAt: 1,
    });

    await modules.playerStore.usePlayerStore.getState().hydrateSession();

    expect(modules.sessionRepo.playbackSessionRepository.clear).toHaveBeenCalledTimes(1);
    expect(modules.playerStore.usePlayerStore.getState().currentSong).toBeNull();
  });
});
