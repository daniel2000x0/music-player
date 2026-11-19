import { makeSong } from '@/testing/fixtures';
import type { Song } from '@/types/song';
import type {
  LockScreenHealth,
  PlaybackStatus,
  SessionSnapshot,
} from '@/services/audio';

/**
 * Pruebas de orquestación del store de reproducción (`FASE 7`).
 *
 * LÓGICA: el store coordina la fachada del motor (`@/services/audio`), la
 * persistencia diferida, el historial y los avisos. Se sustituyen todas esas
 * dependencias para verificar QUÉ se pide y CUÁNDO, sin depender de expo-audio.
 * Varias piezas viven en estado de módulo (`seekTarget`, `sessionHydrated`,
 * `volumePersistTimer`, `lastPosition`), así que se recargan los módulos en
 * cada prueba con `jest.resetModules()` y se vuelven a requerir.
 */
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { appOwnership: null, executionEnvironment: 'bare' },
}));

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
    get: jest.fn(async () => ({ theme: 'dark', volume: 1 })),
    setTheme: jest.fn(async () => undefined),
    setVolume: jest.fn(async () => undefined),
  },
}));

jest.mock('@/services/audio', () => ({
  appendSong: jest.fn(),
  getCurrentIndex: jest.fn(() => 0),
  getTrackCount: jest.fn(() => 0),
  // Por defecto el motor ya tiene la cola cargada; cada prueba que necesite
  // simular una sesión restaurada cambia este valor.
  hasQueue: jest.fn(() => true),
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
  resetSessionPersistence: jest.fn(),
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
  historyRepo: typeof import('@/data/repositories/history.repository');
  audio: typeof import('@/services/audio');
  persistence: typeof import('@/services/audio/session-persistence');
  library: typeof import('@/stores/library.store');
  notice: typeof import('@/stores/notice.store');
  progress: typeof import('@/stores/playback-progress');
  config: typeof import('@/services/audio/config');
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
    historyRepo: require('@/data/repositories/history.repository'),
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    audio: require('@/services/audio'),
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    persistence: require('@/services/audio/session-persistence'),
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    library: require('@/stores/library.store'),
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    notice: require('@/stores/notice.store'),
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    progress: require('@/stores/playback-progress'),
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    config: require('@/services/audio/config'),
  };
}

let modules: Loaded;

/** El mock de `library.store` expone su estado mutable en `__state`. */
function setLibrarySongs(songs: Song[]): void {
  (modules.library.useLibraryStore as unknown as { __state: { songs: Song[] } }).__state.songs =
    songs;
}

/** Estado del reproductor (atajo para no repetir `getState()`). */
function player() {
  return modules.playerStore.usePlayerStore;
}

/** Ejecuta el constructor diferido que recibió `saveSessionNow`. */
function savedNow(index = 0) {
  const build = jest.mocked(modules.persistence.saveSessionNow).mock.calls[index][0];
  return build();
}

/** Ejecuta el constructor diferido que recibió `saveSessionSoon`. */
function savedSoon(index = 0) {
  const build = jest.mocked(modules.persistence.saveSessionSoon).mock.calls[index][0];
  return build();
}

/** Tick del motor con valores por defecto válidos. */
function tick(overrides: Partial<PlaybackStatus> = {}): PlaybackStatus {
  return {
    currentIndex: 0,
    playing: true,
    currentTime: 0,
    duration: 180,
    isBuffering: false,
    ...overrides,
  };
}

beforeEach(() => {
  jest.resetModules();
  // Los timers falsos son necesarios para el debounce del volumen y para el
  // timeout de confirmación del seek (ambos usan `Date.now()`/setTimeout).
  jest.useFakeTimers();
  modules = loadModules();
  modules.notice.useNoticeStore.getState().clear();
  setLibrarySongs([]);
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe('player.store: play', () => {
  it('fija pista, cola y banderas, y reinicia el contador de escucha', () => {
    const first = makeSong({ id: 1, duration: 120 });
    const second = makeSong({ id: 2, duration: 200 });

    player().setState({ listenedSeconds: 42, recordedSongId: 7, isPlaying: false });
    player().getState().play(first, [first, second]);

    expect(player().getState()).toMatchObject({
      currentSong: first,
      queue: [first, second],
      isPlaying: true,
      listenedSeconds: 0,
      recordedSongId: null,
    });
    expect(modules.progress.getPlaybackPosition()).toBe(0);
    expect(modules.progress.getPlaybackDuration()).toBe(120);
  });

  it('arranca la cola nativa con reinicio y guarda la sesión resultante', () => {
    const first = makeSong({ id: 1 });
    const second = makeSong({ id: 2 });
    player().setState({ repeatMode: 'all', shuffle: true });

    player().getState().play(first, [first, second]);

    expect(modules.audio.startQueue).toHaveBeenCalledWith([first, second], {
      startSongId: 1,
      loop: 'all',
      shuffle: true,
      restart: true,
    });
    expect(modules.persistence.saveSessionNow).toHaveBeenCalledTimes(1);
    expect(savedNow()).toMatchObject({
      queueSongIds: [1, 2],
      currentSongId: 1,
      positionSeconds: 0,
      repeatMode: 'all',
      shuffle: true,
    });
  });

  it('conserva la cola actual si ya contiene la pista', () => {
    const first = makeSong({ id: 1 });
    const second = makeSong({ id: 2 });
    player().setState({ queue: [first, second] });

    player().getState().play(second);

    expect(player().getState().queue).toEqual([first, second]);
    expect(modules.audio.startQueue).toHaveBeenCalledWith(
      [first, second],
      expect.objectContaining({ startSongId: 2 })
    );
  });

  it('reduce la cola a la pista cuando no estaba en ella', () => {
    const other = makeSong({ id: 9 });
    const chosen = makeSong({ id: 3 });
    player().setState({ queue: [other] });

    player().getState().play(chosen);

    expect(player().getState().queue).toEqual([chosen]);
  });
});

describe('player.store: playQueueIndex', () => {
  it('reinicia la pista actual desde cero con un seek a 0', () => {
    const song = makeSong({ id: 1, duration: 180 });
    player().setState({ currentSong: song, queue: [song], isPlaying: false });
    modules.progress.setPlaybackProgress(42, 180);

    player().getState().playQueueIndex(0);

    expect(player().getState().isPlaying).toBe(true);
    expect(player().getState().currentSong).toEqual(song);
    expect(modules.progress.getPlaybackPosition()).toBe(0);
    expect(modules.audio.seekTo).toHaveBeenCalledWith(0);
    expect(modules.audio.startQueue).toHaveBeenCalledWith(
      [song],
      expect.objectContaining({ startSongId: 1, restart: true })
    );
    expect(modules.persistence.saveSessionNow).toHaveBeenCalledTimes(1);
  });

  it('cambia de pista sin seek adicional', () => {
    const first = makeSong({ id: 1 });
    const second = makeSong({ id: 2 });
    player().setState({ currentSong: first, queue: [first, second] });

    player().getState().playQueueIndex(1);

    expect(player().getState().currentSong).toEqual(second);
    expect(modules.audio.seekTo).not.toHaveBeenCalled();
  });

  it('ignora un índice fuera de la cola', () => {
    const song = makeSong({ id: 1 });
    player().setState({ currentSong: song, queue: [song] });

    player().getState().playQueueIndex(5);

    expect(player().getState().currentSong).toEqual(song);
    expect(modules.audio.startQueue).not.toHaveBeenCalled();
  });
});

describe('player.store: toggle', () => {
  it('alterna la reproducción cuando el motor ya tiene la cola', () => {
    const song = makeSong({ id: 1 });
    player().setState({ currentSong: song, queue: [song] });
    jest.mocked(modules.audio.hasQueue).mockReturnValue(true);

    player().getState().toggle();

    expect(modules.audio.togglePlayback).toHaveBeenCalledTimes(1);
    expect(modules.audio.rebuildQueue).not.toHaveBeenCalled();
    expect(modules.persistence.saveSessionNow).toHaveBeenCalledTimes(1);
  });

  it('carga la cola restaurada en la posición guardada y arranca sin toggle', () => {
    const song = makeSong({ id: 1 });
    player().setState({ currentSong: song, queue: [song] });
    modules.progress.setPlaybackProgress(30, 180);
    jest.mocked(modules.audio.hasQueue).mockReturnValue(false);

    player().getState().toggle();

    expect(modules.audio.rebuildQueue).toHaveBeenCalledWith([song], {
      currentSongId: 1,
      loop: 'none',
      shuffle: false,
      position: 30,
      playing: true,
    });
    expect(modules.audio.togglePlayback).not.toHaveBeenCalled();
    expect(modules.persistence.saveSessionNow).toHaveBeenCalledTimes(1);
  });

  it('sin pista actual solo delega en el motor', () => {
    jest.mocked(modules.audio.hasQueue).mockReturnValue(false);

    player().getState().toggle();

    expect(modules.audio.rebuildQueue).not.toHaveBeenCalled();
    expect(modules.audio.togglePlayback).toHaveBeenCalledTimes(1);
  });
});

describe('player.store: next', () => {
  it('se detiene al final sin repetición total', () => {
    const song = makeSong({ id: 1 });
    player().setState({ currentSong: song, queue: [song], isPlaying: true });
    jest.mocked(modules.audio.getCurrentIndex).mockReturnValue(0);
    jest.mocked(modules.audio.getTrackCount).mockReturnValue(1);

    player().getState().next();

    expect(modules.audio.pause).toHaveBeenCalledTimes(1);
    expect(modules.audio.nextTrack).not.toHaveBeenCalled();
    expect(player().getState().isPlaying).toBe(false);
    expect(modules.persistence.saveSessionNow).toHaveBeenCalledTimes(1);
  });

  it('avanza al final de la cola cuando repeat es all', () => {
    const song = makeSong({ id: 1 });
    player().setState({ currentSong: song, queue: [song], repeatMode: 'all' });
    jest.mocked(modules.audio.getCurrentIndex).mockReturnValue(0);
    jest.mocked(modules.audio.getTrackCount).mockReturnValue(1);

    player().getState().next();

    expect(modules.audio.nextTrack).toHaveBeenCalledTimes(1);
    expect(modules.audio.pause).not.toHaveBeenCalled();
  });

  it('avanza cuando aún quedan pistas', () => {
    const first = makeSong({ id: 1 });
    const second = makeSong({ id: 2 });
    player().setState({ currentSong: first, queue: [first, second] });
    jest.mocked(modules.audio.getCurrentIndex).mockReturnValue(0);
    jest.mocked(modules.audio.getTrackCount).mockReturnValue(2);

    player().getState().next();

    expect(modules.audio.maintainWindow).toHaveBeenCalledTimes(1);
    expect(modules.audio.nextTrack).toHaveBeenCalledTimes(1);
  });

  it('no hace nada con la cola vacía', () => {
    player().getState().next();

    expect(modules.audio.nextTrack).not.toHaveBeenCalled();
    expect(modules.persistence.saveSessionNow).not.toHaveBeenCalled();
  });
});

describe('player.store: previous', () => {
  it('vuelve al inicio de la pista si lleva más de 3 segundos', () => {
    const song = makeSong({ id: 1 });
    player().setState({ currentSong: song, queue: [song] });
    modules.progress.setPlaybackProgress(5, 180);

    player().getState().previous();

    expect(modules.audio.seekTo).toHaveBeenCalledWith(0);
    expect(modules.audio.previousTrack).not.toHaveBeenCalled();
    expect(modules.persistence.saveSessionNow).toHaveBeenCalledTimes(1);
  });

  it('va a la pista anterior si lleva 3 segundos o menos', () => {
    const first = makeSong({ id: 1 });
    const second = makeSong({ id: 2 });
    player().setState({ currentSong: second, queue: [first, second] });
    modules.progress.setPlaybackProgress(3, 180);

    player().getState().previous();

    expect(modules.audio.previousTrack).toHaveBeenCalledTimes(1);
    expect(modules.audio.seekTo).not.toHaveBeenCalled();
  });

  it('no hace nada con la cola vacía', () => {
    player().getState().previous();

    expect(modules.audio.previousTrack).not.toHaveBeenCalled();
    expect(modules.audio.seekTo).not.toHaveBeenCalled();
  });
});

describe('player.store: seek', () => {
  it('ignora valores no finitos', () => {
    player().getState().seek(Number.NaN);
    player().getState().seek(Number.POSITIVE_INFINITY);

    expect(modules.audio.seekTo).not.toHaveBeenCalled();
    expect(modules.persistence.saveSessionNow).not.toHaveBeenCalled();
  });

  it('acota el destino a la duración conocida', () => {
    const song = makeSong({ id: 1, duration: 100 });
    player().setState({ currentSong: song });
    modules.progress.setPlaybackProgress(0, 100);

    player().getState().seek(150);

    expect(modules.audio.seekTo).toHaveBeenCalledWith(100);
    expect(modules.progress.getPlaybackPosition()).toBe(100);
  });

  it('acepta el destino sin duración conocida y lo escribe de inmediato', () => {
    player().getState().seek(25);

    expect(modules.audio.seekTo).toHaveBeenCalledWith(25);
    expect(modules.progress.getPlaybackPosition()).toBe(25);
    expect(modules.persistence.saveSessionNow).toHaveBeenCalledTimes(1);
    expect(savedNow().positionSeconds).toBe(25);
  });

  it('no acepta destinos negativos', () => {
    player().getState().seek(-10);

    expect(modules.audio.seekTo).toHaveBeenCalledWith(0);
  });
});

describe('player.store: cycleRepeat', () => {
  it('recorre none → all → single → none y lo persiste', () => {
    player().getState().cycleRepeat();
    expect(player().getState().repeatMode).toBe('all');
    expect(modules.audio.setLoop).toHaveBeenLastCalledWith('all');

    player().getState().cycleRepeat();
    expect(player().getState().repeatMode).toBe('single');
    expect(modules.audio.setLoop).toHaveBeenLastCalledWith('single');

    player().getState().cycleRepeat();
    expect(player().getState().repeatMode).toBe('none');
    expect(modules.audio.setLoop).toHaveBeenLastCalledWith('none');

    expect(modules.audio.setLoop).toHaveBeenCalledTimes(3);
    expect(modules.audio.maintainWindow).toHaveBeenCalledTimes(3);
    expect(modules.persistence.saveSessionNow).toHaveBeenCalledTimes(3);
  });
});

describe('player.store: toggleShuffle', () => {
  it('reconstruye la cola nativa conservando pista y posición', () => {
    const first = makeSong({ id: 1 });
    const second = makeSong({ id: 2 });
    player().setState({ currentSong: first, queue: [first, second], isPlaying: true });
    modules.progress.setPlaybackProgress(30, 180);

    player().getState().toggleShuffle();

    expect(player().getState().shuffle).toBe(true);
    expect(modules.audio.rebuildQueue).toHaveBeenCalledWith([first, second], {
      currentSongId: 1,
      loop: 'none',
      shuffle: true,
      playing: true,
    });
    expect(modules.persistence.saveSessionNow).toHaveBeenCalledTimes(1);
  });

  it('sin pista actual solo cambia la bandera', () => {
    player().getState().toggleShuffle();

    expect(player().getState().shuffle).toBe(true);
    expect(modules.audio.rebuildQueue).not.toHaveBeenCalled();
  });
});

describe('player.store: enqueue y playNext', () => {
  it('enqueue ignora una pista ya presente en la cola', () => {
    const song = makeSong({ id: 1 });
    player().setState({ queue: [song] });

    player().getState().enqueue(song);

    expect(player().getState().queue).toEqual([song]);
    expect(modules.audio.appendSong).not.toHaveBeenCalled();
    expect(modules.persistence.saveSessionSoon).not.toHaveBeenCalled();
  });

  it('enqueue añade al final y agenda la persistencia', () => {
    const first = makeSong({ id: 1 });
    const second = makeSong({ id: 2 });
    player().setState({ queue: [first] });

    player().getState().enqueue(second);

    expect(player().getState().queue).toEqual([first, second]);
    expect(modules.audio.appendSong).toHaveBeenCalledWith(second);
    expect(modules.persistence.saveSessionSoon).toHaveBeenCalledTimes(1);
    expect(savedSoon().queueSongIds).toEqual([1, 2]);
  });

  it('playNext ignora la pista que ya suena', () => {
    const song = makeSong({ id: 1 });
    player().setState({ currentSong: song, queue: [song] });

    player().getState().playNext(song);

    expect(player().getState().queue).toEqual([song]);
    expect(modules.audio.insertAfterCurrent).not.toHaveBeenCalled();
  });

  it('playNext mueve una pista existente justo detrás de la actual', () => {
    const first = makeSong({ id: 1 });
    const second = makeSong({ id: 2 });
    const third = makeSong({ id: 3 });
    player().setState({ currentSong: first, queue: [first, second, third] });

    player().getState().playNext(third);

    expect(player().getState().queue).toEqual([first, third, second]);
    expect(modules.audio.insertAfterCurrent).toHaveBeenCalledWith(third);
    expect(modules.persistence.saveSessionSoon).toHaveBeenCalledTimes(1);
  });

  it('playNext inserta al final si la pista actual no está en la cola', () => {
    const current = makeSong({ id: 9 });
    const first = makeSong({ id: 1 });
    const next = makeSong({ id: 2 });
    player().setState({ currentSong: current, queue: [first] });

    player().getState().playNext(next);

    expect(player().getState().queue).toEqual([first, next]);
  });
});

describe('player.store: removeFromQueue', () => {
  it('quita otra pista sin tocar la actual', () => {
    const first = makeSong({ id: 1 });
    const second = makeSong({ id: 2 });
    player().setState({ currentSong: first, queue: [first, second] });

    player().getState().removeFromQueue(1);

    expect(player().getState()).toMatchObject({
      currentSong: first,
      queue: [first],
      isPlaying: false,
    });
    expect(modules.audio.removeSongById).toHaveBeenCalledWith(2);
    expect(modules.persistence.saveSessionSoon).toHaveBeenCalledTimes(1);
  });

  it('al quitar la actual selecciona la siguiente y reinicia el progreso', () => {
    const first = makeSong({ id: 1, duration: 100 });
    const second = makeSong({ id: 2, duration: 200 });
    player().setState({ currentSong: first, queue: [first, second], isPlaying: true });
    modules.progress.setPlaybackProgress(45, 100);

    player().getState().removeFromQueue(0);

    expect(player().getState()).toMatchObject({
      currentSong: second,
      queue: [second],
      listenedSeconds: 0,
      recordedSongId: null,
      isPlaying: true,
    });
    expect(modules.progress.getPlaybackPosition()).toBe(0);
    expect(modules.progress.getPlaybackDuration()).toBe(200);
    expect(modules.audio.rebuildQueue).toHaveBeenCalledWith([second], {
      currentSongId: 2,
      loop: 'none',
      shuffle: false,
      position: 0,
      playing: true,
    });
  });

  it('al quitar la última pista limpia el estado y la sesión persistida', async () => {
    const song = makeSong({ id: 1, duration: 180 });
    player().setState({ currentSong: song, queue: [song], isPlaying: true });
    modules.progress.setPlaybackProgress(20, 180);

    player().getState().removeFromQueue(0);
    // `flushSessionPersistence().then(clear)` se resuelve en microtareas.
    await Promise.resolve();
    await Promise.resolve();

    expect(modules.audio.stopPlayback).toHaveBeenCalledTimes(1);
    expect(modules.persistence.flushSessionPersistence).toHaveBeenCalledTimes(1);
    expect(modules.sessionRepo.playbackSessionRepository.clear).toHaveBeenCalledTimes(1);
    expect(player().getState()).toMatchObject({
      currentSong: null,
      queue: [],
      isPlaying: false,
    });
    expect(modules.progress.getPlaybackPosition()).toBe(0);
    expect(modules.progress.getPlaybackDuration()).toBe(0);
  });

  it('ignora un índice inexistente', () => {
    const song = makeSong({ id: 1 });
    player().setState({ currentSong: song, queue: [song] });

    player().getState().removeFromQueue(4);

    expect(player().getState().queue).toEqual([song]);
    expect(modules.audio.stopPlayback).not.toHaveBeenCalled();
  });
});

describe('player.store: moveInQueue y clearQueue', () => {
  it('mueve una pista y reconstruye la cola nativa sin aleatorio', () => {
    const first = makeSong({ id: 1 });
    const second = makeSong({ id: 2 });
    const third = makeSong({ id: 3 });
    player().setState({ currentSong: first, queue: [first, second, third] });

    player().getState().moveInQueue(0, 2);

    expect(player().getState().queue).toEqual([second, third, first]);
    expect(modules.audio.rebuildQueue).toHaveBeenCalledWith(
      [second, third, first],
      expect.objectContaining({ currentSongId: 1, shuffle: false })
    );
    expect(modules.persistence.saveSessionSoon).toHaveBeenCalledTimes(1);
  });

  it('con shuffle no reconstruye la cola nativa', () => {
    const first = makeSong({ id: 1 });
    const second = makeSong({ id: 2 });
    player().setState({ currentSong: first, queue: [first, second], shuffle: true });

    player().getState().moveInQueue(0, 1);

    expect(player().getState().queue).toEqual([second, first]);
    expect(modules.audio.rebuildQueue).not.toHaveBeenCalled();
  });

  it('clearQueue sin pista actual solo vacía la cola', () => {
    const song = makeSong({ id: 1 });
    player().setState({ queue: [song] });

    player().getState().clearQueue();

    expect(player().getState().queue).toEqual([]);
    expect(modules.persistence.saveSessionSoon).not.toHaveBeenCalled();
  });

  it('clearQueue conserva solo la pista actual y reconstruye la cola nativa', () => {
    const first = makeSong({ id: 1 });
    const second = makeSong({ id: 2 });
    const third = makeSong({ id: 3 });
    player().setState({ currentSong: first, queue: [first, second, third], isPlaying: true });

    player().getState().clearQueue();

    expect(player().getState().queue).toEqual([first]);
    expect(modules.audio.rebuildQueue).toHaveBeenCalledWith([first], {
      currentSongId: 1,
      loop: 'none',
      shuffle: false,
      playing: true,
    });
    expect(modules.persistence.saveSessionSoon).toHaveBeenCalledTimes(1);
  });
});

describe('player.store: setVolume', () => {
  it('acota el volumen al rango 0–1 y trata NaN como 1', () => {
    player().setState({ volume: 0.5 });

    player().getState().setVolume(2);
    expect(player().getState().volume).toBe(1);

    player().getState().setVolume(-1);
    expect(player().getState().volume).toBe(0);

    player().getState().setVolume(Number.NaN);
    expect(player().getState().volume).toBe(1);

    expect(modules.audio.setVolume).toHaveBeenCalledTimes(3);
    expect(modules.audio.setVolume).toHaveBeenLastCalledWith(1);
  });

  it('no aplica ni persiste un valor repetido', () => {
    player().setState({ volume: 0.5 });

    player().getState().setVolume(0.5);
    jest.advanceTimersByTime(500);

    expect(modules.audio.setVolume).not.toHaveBeenCalled();
    expect(modules.settingsRepo.settingsRepository.setVolume).not.toHaveBeenCalled();
  });

  it('agrupa varios cambios en una sola escritura con el debounce', () => {
    player().getState().setVolume(0.2);
    player().getState().setVolume(0.4);
    player().getState().setVolume(0.6);

    jest.advanceTimersByTime(499);
    expect(modules.settingsRepo.settingsRepository.setVolume).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(modules.settingsRepo.settingsRepository.setVolume).toHaveBeenCalledTimes(1);
    expect(modules.settingsRepo.settingsRepository.setVolume).toHaveBeenCalledWith(0.6);
  });
});

describe('player.store: syncStatus', () => {
  it('suma solo avances continuos mientras reproduce', () => {
    const song = makeSong({ id: 1, duration: 180 });
    player().setState({ currentSong: song });
    modules.progress.setPlaybackProgress(0, 180);

    player().getState().syncStatus(tick({ currentTime: 1 }));
    expect(player().getState().listenedSeconds).toBe(1);

    // Un salto grande (seek) no cuenta como escucha.
    player().getState().syncStatus(tick({ currentTime: 10 }));
    expect(player().getState().listenedSeconds).toBe(1);

    // Tampoco cuenta un retroceso.
    player().getState().syncStatus(tick({ currentTime: 9.5 }));
    expect(player().getState().listenedSeconds).toBe(1);

    // Ni un tick en pausa.
    player().getState().syncStatus(
      tick({ currentTime: 10.5, playing: false, isBuffering: true })
    );
    expect(player().getState().listenedSeconds).toBe(1);
    expect(player().getState().isPlaying).toBe(false);
    expect(player().getState().isBuffering).toBe(true);
    expect(modules.persistence.savePositionThrottled).toHaveBeenCalledTimes(4);
  });

  it('publica posición y duración en el almacén aislado', () => {
    const song = makeSong({ id: 1, duration: 180 });
    player().setState({ currentSong: song });
    modules.progress.setPlaybackProgress(0, 180);

    player().getState().syncStatus(tick({ currentTime: 12, duration: 0 }));

    expect(modules.progress.getPlaybackPosition()).toBe(12);
    // Con duración 0 en el tick se conserva la última duración conocida.
    expect(modules.progress.getPlaybackDuration()).toBe(180);
  });

  it('mantiene el destino del seek hasta que el motor lo confirma', () => {
    const song = makeSong({ id: 1, duration: 180 });
    player().setState({ currentSong: song });
    modules.progress.setPlaybackProgress(0, 180);

    player().getState().seek(30);
    // Tick viejo: la barra no debe saltar atrás.
    player().getState().syncStatus(tick({ currentTime: 2 }));
    expect(modules.progress.getPlaybackPosition()).toBe(30);

    // Tick ya cercano al destino: se confirma y se acepta el valor real.
    player().getState().syncStatus(tick({ currentTime: 30.2 }));
    expect(modules.progress.getPlaybackPosition()).toBe(30.2);
  });

  it('descarta el seek pendiente tras el timeout de confirmación', () => {
    const song = makeSong({ id: 1, duration: 180 });
    player().setState({ currentSong: song });

    player().getState().seek(30);
    jest.advanceTimersByTime(modules.config.AUDIO_CONFIG.seekConfirmationTimeoutMs + 1);

    player().getState().syncStatus(tick({ currentTime: 4 }));

    expect(modules.progress.getPlaybackPosition()).toBe(4);
  });

  it('registra una escucha válida una sola vez y actualiza el contador local', async () => {
    const song = makeSong({ id: 7, duration: 180 });
    player().setState({ currentSong: song, listenedSeconds: 30, recordedSongId: null });

    player().getState().syncStatus(tick({ currentTime: 0 }));

    expect(modules.historyRepo.historyRepository.record).toHaveBeenCalledWith(7, 30, true);
    expect(player().getState().recordedSongId).toBe(7);

    await Promise.resolve();
    await Promise.resolve();
    expect(modules.library.useLibraryStore.getState().recordPlayLocal).toHaveBeenCalledWith(
      7,
      expect.any(Number)
    );

    player().getState().syncStatus(tick({ currentTime: 1 }));
    expect(modules.historyRepo.historyRepository.record).toHaveBeenCalledTimes(1);
  });

  it('no registra una escucha por debajo del umbral', () => {
    const song = makeSong({ id: 7, duration: 180 });
    player().setState({ currentSong: song, listenedSeconds: 10 });

    player().getState().syncStatus(tick({ currentTime: 0 }));

    expect(modules.historyRepo.historyRepository.record).not.toHaveBeenCalled();
    expect(player().getState().recordedSongId).toBeNull();
  });
});

describe('player.store: syncTrack, lock screen y estado de sesión', () => {
  it('syncTrack refleja la pista del motor y reinicia progreso y contadores', () => {
    const first = makeSong({ id: 1 });
    const second = makeSong({ id: 2 });
    player().setState({ currentSong: first, listenedSeconds: 20, recordedSongId: 3 });
    modules.progress.setPlaybackProgress(20, 180);

    player().getState().syncTrack(second);

    expect(player().getState()).toMatchObject({
      currentSong: second,
      listenedSeconds: 0,
      recordedSongId: null,
    });
    expect(modules.progress.getPlaybackPosition()).toBe(0);
    expect(modules.progress.getPlaybackDuration()).toBe(180);
    expect(modules.audio.maintainWindow).toHaveBeenCalledTimes(1);
    expect(modules.persistence.saveSessionNow).toHaveBeenCalledTimes(1);
  });

  it('syncTrack ignora al mismo pista', () => {
    const song = makeSong({ id: 1 });
    player().setState({ currentSong: song });

    player().getState().syncTrack(song);

    expect(modules.persistence.saveSessionNow).not.toHaveBeenCalled();
    expect(modules.audio.maintainWindow).not.toHaveBeenCalled();
  });

  it('syncLockScreen publica el estado de salud y ignora repeticiones', () => {
    const health: LockScreenHealth = {
      status: 'degraded',
      attempts: 2,
      lastError: 'sin notificaciones',
    };

    player().getState().syncLockScreen(health);
    expect(player().getState().lockScreen).toEqual(health);

    player().getState().syncLockScreen({ ...health });
    expect(modules.persistence.saveSessionNow).not.toHaveBeenCalled();
  });

  it('syncSessionState publica el estado real del motor y ignora repeticiones', () => {
    const snapshot: SessionSnapshot = { state: 'recovering', error: null };

    player().getState().syncSessionState(snapshot);
    expect(player().getState().sessionState).toBe('recovering');

    player().getState().syncSessionState({ state: 'recovering', error: 'otro motivo' });
    expect(player().getState().sessionState).toBe('recovering');
  });
});

describe('player.store: hydrateSession', () => {
  it('restaura en pausa, filtra pistas ausentes y avisa', async () => {
    const first = makeSong({ id: 1, duration: 180 });
    const second = makeSong({ id: 2, duration: 180 });
    setLibrarySongs([first, second]);
    jest.mocked(modules.sessionRepo.playbackSessionRepository.load).mockResolvedValueOnce({
      queueSongIds: [1, 99, 2],
      currentSongId: 99,
      positionSeconds: 10,
      repeatMode: 'all',
      shuffle: true,
      updatedAt: 1,
    });

    await player().getState().hydrateSession();

    expect(player().getState()).toMatchObject({
      queue: [first, second],
      currentSong: first,
      isPlaying: false,
      isBuffering: false,
      repeatMode: 'all',
      shuffle: true,
      listenedSeconds: 0,
      recordedSongId: null,
    });
    expect(modules.progress.getPlaybackPosition()).toBe(10);
    expect(modules.notice.useNoticeStore.getState().notices[0]).toMatchObject({
      code: 'player.session-restored',
      severity: 'info',
    });
    expect(modules.audio.startQueue).not.toHaveBeenCalled();
    expect(modules.audio.rebuildQueue).not.toHaveBeenCalled();
  });

  it('aplica el volumen guardado al store y al motor', async () => {
    jest.mocked(modules.settingsRepo.settingsRepository.get).mockResolvedValueOnce({
      theme: 'dark',
      volume: 0.3,
    });

    await player().getState().hydrateSession();

    expect(player().getState().volume).toBe(0.3);
    expect(modules.audio.setVolume).toHaveBeenCalledWith(0.3);
  });

  it('no borra la sesión si la biblioteca todavía está vacía', async () => {
    setLibrarySongs([]);
    jest.mocked(modules.sessionRepo.playbackSessionRepository.load).mockResolvedValueOnce({
      queueSongIds: [1, 2],
      currentSongId: 1,
      positionSeconds: 0,
      repeatMode: 'none',
      shuffle: false,
      updatedAt: 1,
    });

    await player().getState().hydrateSession();

    expect(modules.sessionRepo.playbackSessionRepository.clear).not.toHaveBeenCalled();
    expect(player().getState().currentSong).toBeNull();
  });

  it('limpia la fila cuando ninguna pista de la cola sobrevive', async () => {
    setLibrarySongs([makeSong({ id: 99 })]);
    jest.mocked(modules.sessionRepo.playbackSessionRepository.load).mockResolvedValueOnce({
      queueSongIds: [1, 2],
      currentSongId: 1,
      positionSeconds: 0,
      repeatMode: 'none',
      shuffle: false,
      updatedAt: 1,
    });

    await player().getState().hydrateSession();

    expect(modules.sessionRepo.playbackSessionRepository.clear).toHaveBeenCalledTimes(1);
    expect(player().getState().currentSong).toBeNull();
  });

  it('es idempotente: una segunda llamada no vuelve a leer la sesión', async () => {
    setLibrarySongs([makeSong({ id: 1 })]);

    await player().getState().hydrateSession();
    await player().getState().hydrateSession();

    expect(modules.sessionRepo.playbackSessionRepository.load).toHaveBeenCalledTimes(1);
  });

  it('comparte la promesa entre hidrataciones concurrentes', async () => {
    setLibrarySongs([makeSong({ id: 1 })]);

    const first = player().getState().hydrateSession();
    const second = player().getState().hydrateSession();
    await Promise.all([first, second]);

    expect(modules.sessionRepo.playbackSessionRepository.load).toHaveBeenCalledTimes(1);
  });
});
