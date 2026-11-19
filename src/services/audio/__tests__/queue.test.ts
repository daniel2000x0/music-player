/**
 * Orquestación de la reproducción (`queue`).
 *
 * LÓGICA: la cola se reutiliza solo si el orden coincide; si cambia se recrea.
 * Las decisiones de play/pause se toman por la INTENCIÓN de la sesión, no por
 * `playlist.playing`, que es `false` durante el buffering. Los fallos nativos
 * llevan la sesión a `failed` y se registran antes de propagarse.
 */

import type { FakePlaylist } from '@/testing/mocks/expo-audio';
import { makeSong } from '@/testing/fixtures';
import type { Song } from '@/types/song';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { appOwnership: null, executionEnvironment: 'bare' },
}));

jest.mock('expo-audio', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@/testing/mocks/expo-audio')
);

jest.mock('@/services/error-log.service', () => ({
  logError: jest.fn(),
  logWarning: jest.fn(),
}));

type AudioMock = typeof import('@/testing/mocks/expo-audio');
type Queue = typeof import('@/services/audio/queue');
type Native = typeof import('@/services/audio/native-playlist');
type Session = typeof import('@/services/audio/session');
type ErrorLog = typeof import('@/services/error-log.service');

let audio: AudioMock;
let queue: Queue;
let native: Native;
let session: Session;
let errorLog: ErrorLog;

function library(count: number): Song[] {
  return Array.from({ length: count }, (_, index) =>
    makeSong({ id: index + 1, uri: `file:///music/${index + 1}.mp3` })
  );
}

function start(songs: Song[], startSongId: number, startPaused = false): FakePlaylist {
  queue.startQueue(songs, {
    startSongId,
    loop: 'none',
    shuffle: false,
    ...(startPaused ? { startPaused: true } : {}),
  });
  return audio.__last() as FakePlaylist;
}

beforeEach(() => {
  jest.resetModules();
  audio = jest.requireMock<AudioMock>('expo-audio');
  audio.__reset();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  queue = require('@/services/audio/queue') as Queue;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  native = require('@/services/audio/native-playlist') as Native;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  session = require('@/services/audio/session') as Session;
  errorLog = jest.requireMock<ErrorLog>('@/services/error-log.service');
});

afterEach(() => {
  // En `failed`, `paused` no es una transición legal: solo liberamos el motor.
  if (session.getSession().state !== 'failed') {
    queue.stopPlayback();
  }
  native.disposePlaylist();
  session.resetSession();
});

describe('cola: reconstrucción, ventana e intención de reproducción', () => {
  it('rebuildQueue conserva pista, posición y estado', () => {
    const original = library(5);
    start(original, 1);
    const before = audio.__last();
    before?.seekTo.mockClear();

    queue.rebuildQueue(library(3), {
      currentSongId: 2,
      loop: 'single',
      shuffle: false,
      position: 42,
      playing: true,
    });

    const rebuilt = audio.__last();
    expect(rebuilt).not.toBe(before);
    expect(native.getOrder().map((song) => song.id)).toEqual([1, 2, 3]);
    expect(native.getCurrentSong()?.id).toBe(2);
    expect(rebuilt?.seekTo).toHaveBeenCalledWith(42);
    expect(rebuilt?.loop).toBe('single');
    expect(session.getSession().state).toBe('playing');
  });

  it('refreshWindow recorta la ventana sin reordenar y sin cola no hace nada', () => {
    const all = library(250);
    const first = start(all, 110);
    first.currentIndex = 185;

    queue.refreshWindow(native.getCurrentSong()?.id ?? null);

    const recentered = audio.__last();
    expect(recentered).not.toBe(first);
    // La ventana se recorta desde la nueva posición hasta el final de la cola.
    expect(recentered?.sources).toHaveLength(156);
    expect(native.getOrder()).toEqual(all);
    expect(native.getCurrentSong()?.id).toBe(195);
    expect(session.getSession().state).toBe('playing');

    native.disposePlaylist();
    const calls = audio.createAudioPlaylist.mock.calls.length;
    queue.refreshWindow(1);
    expect(audio.createAudioPlaylist).toHaveBeenCalledTimes(calls);
  });

  it('maintainWindow recentra solo al acercarse al borde', () => {
    const first = start(library(250), 110);

    first.currentIndex = 120;
    queue.maintainWindow();
    expect(audio.createAudioPlaylist).toHaveBeenCalledTimes(1);

    first.currentIndex = 190;
    queue.maintainWindow();
    expect(audio.createAudioPlaylist).toHaveBeenCalledTimes(2);
    expect(native.getCurrentSong()?.id).toBe(200);
  });

  it('togglePlayback decide por la intención aunque el nativo reporte buffering', () => {
    const instance = start(library(3), 1);
    // La sesión quiere sonar: aunque `playing` sea false, el botón debe pausar.
    instance.playing = false;
    instance.play.mockClear();
    instance.pause.mockClear();

    queue.togglePlayback();

    expect(instance.pause).toHaveBeenCalledTimes(1);
    expect(instance.play).not.toHaveBeenCalled();
    expect(session.getSession().state).toBe('paused');

    // Ahora la intención es pausa, aunque el getter nativo diga lo contrario.
    instance.playing = true;
    instance.play.mockClear();

    queue.togglePlayback();

    expect(instance.play).toHaveBeenCalledTimes(1);
    expect(session.getSession().state).toBe('playing');
  });

  it('stopPlayback pausa, retira los controles y conserva la cola', () => {
    const instance = start(library(3), 1);

    queue.stopPlayback();

    expect(instance.pause).toHaveBeenCalled();
    expect(instance.clearLockScreenControls).toHaveBeenCalled();
    expect(session.getSession().state).toBe('ready');
    expect(native.hasQueue()).toBe(true);
  });

  it('startQueue reutiliza la playlist si el orden coincide', () => {
    const first = start(library(5), 1);

    queue.startQueue(library(5), { startSongId: 3, loop: 'all', shuffle: false });

    expect(audio.createAudioPlaylist).toHaveBeenCalledTimes(1);
    expect(first.skipTo).toHaveBeenCalledWith(2);
    expect(native.getLoop()).toBe('all');
    expect(session.getSession().state).toBe('playing');
  });

  it('startQueue reconstruye cuando cambia el orden', () => {
    start(library(5), 1);
    const changed = library(5).reverse();

    queue.startQueue(changed, { startSongId: 5, loop: 'none', shuffle: false });

    expect(audio.createAudioPlaylist).toHaveBeenCalledTimes(2);
    expect(native.getOrder().map((song) => song.id)).toEqual([5, 4, 3, 2, 1]);
    expect(native.getCurrentSong()?.id).toBe(5);
  });

  it('startQueue propaga el fallo nativo y marca la sesión failed', () => {
    audio.createAudioPlaylist.mockImplementationOnce(() => {
      throw new Error('fallo nativo');
    });

    expect(() =>
      queue.startQueue(library(3), { startSongId: 1, loop: 'none', shuffle: false })
    ).toThrow('fallo nativo');
    expect(session.getSession()).toEqual({ state: 'failed', error: 'fallo nativo' });
    expect(errorLog.logError).toHaveBeenCalledWith(
      'audio/queue',
      'startQueue',
      expect.any(Error)
    );
  });

  it('rebuildQueue propaga el fallo desde recovering', () => {
    start(library(3), 1);
    audio.createAudioPlaylist.mockImplementationOnce(() => {
      throw new Error('fallo al reconstruir');
    });

    expect(() =>
      queue.rebuildQueue(library(3), {
        currentSongId: 1,
        loop: 'none',
        shuffle: false,
      })
    ).toThrow('fallo al reconstruir');
    expect(session.getSession()).toEqual({ state: 'failed', error: 'fallo al reconstruir' });
    expect(errorLog.logError).toHaveBeenCalledWith(
      'audio/queue',
      'rebuildQueue',
      expect.any(Error)
    );
  });
});
