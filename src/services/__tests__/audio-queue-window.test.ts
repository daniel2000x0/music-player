import { makeSong } from '@/testing/fixtures';
import type { Song } from '@/types/song';

/**
 * Regresión del ANR: el motor nativo solo debe recibir una VENTANA del orden de
 * reproducción. Entregar la cola completa (p. ej. 1801 pistas) hace que
 * `MediaSession` publique toda la cola en una transacción binder del hilo
 * principal y la app deje de responder.
 *
 * LÓGICA: se sustituye `expo-audio` por una playlist falsa que registra las
 * fuentes que recibe y permite mover el índice nativo. Se verifica cuántas
 * pistas se entregan, que los índices hacia fuera son del orden completo y que
 * la ventana se recentra al acercarse a sus bordes.
 */

/** Forma de la playlist falsa; el prefijo `mock` lo exige `jest.mock`. */
type mockFakePlaylist = {
  sources: { uri: string }[];
  playing: boolean;
  currentIndex: number;
  currentTime: number;
  trackCount: number;
  loop: string;
  volume: number;
  setActiveForLockScreen: jest.Mock;
  updateLockScreenMetadata: jest.Mock;
  clearLockScreenControls: jest.Mock;
  play: jest.Mock;
  pause: jest.Mock;
  skipTo: jest.Mock;
  next: jest.Mock;
  previous: jest.Mock;
  add: jest.Mock;
  insert: jest.Mock;
  remove: jest.Mock;
  seekTo: jest.Mock;
  destroy: jest.Mock;
  release: jest.Mock;
  addListener: jest.Mock;
};

jest.mock('expo-constants', () => ({ __esModule: true, default: { appOwnership: null } }));

jest.mock('expo-audio', () => {
  const instances: mockFakePlaylist[] = [];

  const createInstance = (sources: { uri: string }[]): mockFakePlaylist => {
    const instance: mockFakePlaylist = {
      sources,
      playing: false,
      currentIndex: 0,
      currentTime: 0,
      trackCount: sources.length,
      loop: 'none',
      volume: 1,
      setActiveForLockScreen: jest.fn(),
      updateLockScreenMetadata: jest.fn(),
      clearLockScreenControls: jest.fn(),
      play: jest.fn(() => {
        instance.playing = true;
      }),
      pause: jest.fn(() => {
        instance.playing = false;
      }),
      skipTo: jest.fn((index: number) => {
        instance.currentIndex = index;
      }),
      next: jest.fn(() => {
        instance.currentIndex = Math.min(instance.currentIndex + 1, instance.trackCount - 1);
      }),
      previous: jest.fn(() => {
        instance.currentIndex = Math.max(instance.currentIndex - 1, 0);
      }),
      add: jest.fn(),
      insert: jest.fn(),
      remove: jest.fn(),
      seekTo: jest.fn(async () => undefined),
      destroy: jest.fn(),
      release: jest.fn(),
      addListener: jest.fn(() => ({ remove: jest.fn() })),
    };
    instances.push(instance);
    return instance;
  };

  return {
    __instances: instances,
    createAudioPlaylist: jest.fn((options: { sources: { uri: string }[] }) =>
      createInstance(options.sources)
    ),
    requestNotificationPermissionsAsync: jest.fn(async () => ({ granted: true })),
    setAudioModeAsync: jest.fn(async () => undefined),
  };
});

jest.mock('@/services/error-log.service', () => ({
  logError: jest.fn(),
  logWarning: jest.fn(),
}));

type Engine = typeof import('@/services/audio');

let engine: Engine;
let audioMock: {
  createAudioPlaylist: jest.Mock;
  __instances: mockFakePlaylist[];
};

function library(count: number): Song[] {
  return Array.from({ length: count }, (_, index) =>
    makeSong({ id: index + 1, uri: `file:///music/${index + 1}.mp3` })
  );
}

function lastInstance(): mockFakePlaylist {
  const instances = audioMock.__instances;
  return instances[instances.length - 1];
}

function playlistCount(): number {
  return audioMock.createAudioPlaylist.mock.calls.length;
}

beforeEach(() => {
  jest.resetModules();
  audioMock = jest.requireMock('expo-audio');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  engine = require('@/services/audio') as Engine;
});

afterEach(() => {
  engine.stopPlayback();
});

describe('ventana de cola: el motor no recibe la cola completa (ANR)', () => {
  it('entrega una ventana acotada de una cola de 1801 pistas', () => {
    engine.startQueue(library(1801), { startSongId: 900, loop: 'none', shuffle: false });

    const instance = lastInstance();
    // 100 por delante + 100 por detrás + la actual.
    expect(instance.sources).toHaveLength(201);
    expect(instance.currentIndex).toBe(100);
    // Los índices que se exponen son del orden completo, no de la ventana.
    expect(engine.getCurrentIndex()).toBe(899);
    expect(engine.getTrackCount()).toBe(1801);
  });

  it('no recorta las colas que caben en la ventana', () => {
    engine.startQueue(library(30), { startSongId: 10, loop: 'none', shuffle: false });

    const instance = lastInstance();
    expect(instance.sources).toHaveLength(30);
    expect(engine.getCurrentIndex()).toBe(9);
  });

  it('recentra la ventana al acercarse a su borde por delante', () => {
    engine.startQueue(library(1801), { startSongId: 900, loop: 'none', shuffle: false });
    const first = lastInstance();
    const before = playlistCount();

    // La pista actual llega a 10 del final de la ventana.
    first.currentIndex = 190;
    engine.maintainWindow();

    expect(playlistCount()).toBe(before + 1);
    const recentered = lastInstance();
    expect(recentered.sources).toHaveLength(201);
    // La pista actual (índice completo 989) no cambia al recentrar.
    expect(engine.getCurrentIndex()).toBe(989);
  });

  it('no recentra en el centro de la ventana', () => {
    engine.startQueue(library(1801), { startSongId: 900, loop: 'none', shuffle: false });
    const first = lastInstance();
    const before = playlistCount();

    first.currentIndex = 120;
    engine.maintainWindow();

    expect(playlistCount()).toBe(before);
  });

  it('con repetición total la ventana da la vuelta al final de la cola', () => {
    engine.startQueue(library(1801), { startSongId: 1801, loop: 'all', shuffle: false });

    const instance = lastInstance();
    expect(instance.sources).toHaveLength(201);
    expect(engine.getCurrentIndex()).toBe(1800);

    // El motor avanza desde la última pista: la siguiente es la primera.
    instance.currentIndex = 101;
    expect(engine.getCurrentIndex()).toBe(0);
  });
});
