/**
 * Ciclo de vida de la playlist nativa (`native-playlist`).
 *
 * LÓGICA: el motor recibe solo una ventana del orden completo; hacia fuera se
 * exponen índices del orden entero. El volumen y el modo de repetición viven en
 * el módulo para reaplicarse al reconstruir la playlist. Los eventos de una
 * instancia ya reemplazada se descartan para no contaminar la cola nueva.
 */

import type { FakePlaylist } from '@/testing/mocks/expo-audio';
import { makeSong } from '@/testing/fixtures';
import type { PlaybackStatus } from '@/services/audio/native-playlist';
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
type Native = typeof import('@/services/audio/native-playlist');
type ErrorLog = typeof import('@/services/error-log.service');

let audio: AudioMock;
let native: Native;
let errorLog: ErrorLog;

function library(count: number): Song[] {
  return Array.from({ length: count }, (_, index) =>
    makeSong({ id: index + 1, uri: `file:///music/${index + 1}.mp3` })
  );
}

function create(
  songs: Song[],
  startIndex = 0,
  onStatus: (status: PlaybackStatus) => void = jest.fn(),
  onTrack: (song: Song) => void = jest.fn()
): FakePlaylist {
  return native.createPlaylist(
    songs,
    'none',
    { onStatus, onTrack },
    startIndex
  ) as unknown as FakePlaylist;
}

beforeEach(() => {
  jest.resetModules();
  audio = jest.requireMock<AudioMock>('expo-audio');
  audio.__reset();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  native = require('@/services/audio/native-playlist') as Native;
  errorLog = jest.requireMock<ErrorLog>('@/services/error-log.service');
});

afterEach(() => {
  native.disposePlaylist();
});

describe('playlist nativa: ventana, índices y ciclo de vida', () => {
  it('createPlaylist entrega una ventana y sitúa la pista inicial dentro de ella', () => {
    const instance = create(library(250), 110);

    expect(audio.createAudioPlaylist).toHaveBeenCalledTimes(1);
    expect(instance.sources).toHaveLength(201);
    expect(instance.sources[0]).toEqual({ uri: 'file:///music/11.mp3' });
    expect(instance.sources[200]).toEqual({ uri: 'file:///music/211.mp3' });
    expect(instance.skipTo).toHaveBeenCalledWith(100);
    expect(instance.updateInterval).toBe(500);
    expect(instance.loop).toBe('none');
  });

  it('getOrder/getTrackCount describen la cola completa, no la ventana', () => {
    const all = library(250);
    create(all, 110);

    expect(native.getOrder()).toEqual(all);
    expect(native.getOrder()).toHaveLength(250);
    expect(native.getTrackCount()).toBe(250);
  });

  it('getCurrentIndex/getCurrentSong traducen el índice nativo al completo', () => {
    const instance = create(library(250), 110);
    expect(native.getCurrentIndex()).toBe(110);

    // El índice nativo 115 corresponde al 115 del tramo, que empieza en 10.
    instance.currentIndex = 115;
    expect(native.getCurrentIndex()).toBe(125);
    expect(native.getCurrentSong()?.id).toBe(126);

    instance.currentIndex = 999;
    expect(native.getCurrentIndex()).toBe(-1);
    expect(native.getCurrentSong()).toBeNull();
  });

  it('isInWindow y skipToFullIndex solo operan dentro de la ventana', () => {
    const instance = create(library(250), 110);

    expect(native.isInWindow(115)).toBe(true);
    expect(native.isInWindow(0)).toBe(false);
    expect(native.skipToFullIndex(115)).toBe(true);
    expect(instance.skipTo).toHaveBeenLastCalledWith(105);

    instance.skipTo.mockClear();
    expect(native.skipToFullIndex(0)).toBe(false);
    expect(instance.skipTo).not.toHaveBeenCalled();
    expect(native.getCurrentIndex()).toBe(115);
  });

  it('setLoop/getLoop se reflejan en la instancia nativa', () => {
    const instance = create(library(4));

    native.setLoop('single');
    expect(native.getLoop()).toBe('single');
    expect(instance.loop).toBe('single');

    native.setLoop('all');
    expect(native.getLoop()).toBe('all');
    expect(instance.loop).toBe('all');
  });

  it('setVolume/getVolume acota el valor a 0..1', () => {
    const instance = create(library(4));

    native.setVolume(0.35);
    expect(native.getVolume()).toBe(0.35);
    expect(instance.volume).toBe(0.35);

    native.setVolume(-2);
    expect(native.getVolume()).toBe(0);
    expect(instance.volume).toBe(0);

    native.setVolume(5);
    expect(native.getVolume()).toBe(1);
    expect(instance.volume).toBe(1);
  });

  it('el volumen se reaplica al reconstruir la playlist', () => {
    create(library(4), 0);
    native.setVolume(0.2);

    const rebuilt = create(library(4), 2);

    expect(rebuilt.volume).toBe(0.2);
    expect(native.getVolume()).toBe(0.2);
  });

  it('disposePlaylist pausa, destruye, libera y retira los oyentes', () => {
    const instance = create(library(3), 1);
    const subscriptions = instance.addListener.mock.results.map(
      (result) => result.value as { remove: jest.Mock }
    );

    native.disposePlaylist();

    expect(instance.pause).toHaveBeenCalledTimes(1);
    expect(instance.destroy).toHaveBeenCalledTimes(1);
    expect(instance.release).toHaveBeenCalledTimes(1);
    for (const subscription of subscriptions) {
      expect(subscription.remove).toHaveBeenCalledTimes(1);
    }
    expect(native.getPlaylist()).toBeNull();
    expect(native.hasQueue()).toBe(false);
    expect(native.getTrackCount()).toBe(0);
    expect(native.getCurrentIndex()).toBe(-1);
  });

  it('withPlaylist registra fallos sin propagarlos y no ejecuta sin playlist', () => {
    const run = jest.fn(() => {
      throw new Error('fallo nativo');
    });

    expect(() => native.withPlaylist('playlist.prueba', run)).not.toThrow();
    expect(run).not.toHaveBeenCalled();
    expect(errorLog.logError).not.toHaveBeenCalled();

    create(library(2));
    expect(() => native.withPlaylist('playlist.prueba', run)).not.toThrow();
    expect(run).toHaveBeenCalledTimes(1);
    expect(errorLog.logError).toHaveBeenCalledWith(
      'audio/playlist',
      'playlist.prueba',
      expect.any(Error)
    );
  });

  it('los ticks con tiempos negativos se acotan a 0', () => {
    const onStatus = jest.fn();
    const instance = create(library(3), 0, onStatus);

    instance.__emit('playlistStatusUpdate', {
      currentIndex: 0,
      playing: false,
      currentTime: -5,
      duration: -1,
      isBuffering: false,
    });

    expect(onStatus).toHaveBeenCalledWith({
      currentIndex: 0,
      playing: false,
      currentTime: 0,
      duration: 0,
      isBuffering: false,
    });
  });

  it('descarta los eventos de una playlist reemplazada', () => {
    const oldOnStatus = jest.fn();
    const newOnStatus = jest.fn();
    const old = create(library(3), 0, oldOnStatus);
    const replacement = create(library(3), 1, newOnStatus);

    old.__emit('playlistStatusUpdate', {
      currentIndex: 0,
      playing: true,
      currentTime: 1,
      duration: 10,
      isBuffering: false,
    });
    replacement.__emit('playlistStatusUpdate', {
      currentIndex: 1,
      playing: true,
      currentTime: 2,
      duration: 20,
      isBuffering: false,
    });

    expect(oldOnStatus).not.toHaveBeenCalled();
    expect(newOnStatus).toHaveBeenCalledTimes(1);
    expect(newOnStatus).toHaveBeenCalledWith(expect.objectContaining({ currentIndex: 1 }));
    expect(native.getPlaylist()).toBe(replacement);
  });
});
