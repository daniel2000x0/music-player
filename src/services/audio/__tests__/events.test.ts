/**
 * Bus de eventos del motor (`events`).
 *
 * LÓGICA: los callbacks nativos se traducen a oyentes de la app; los ticks solo
 * cambian la fase de la sesión cuando el estado nativo contradice al declarado.
 * Un oyente roto se registra en `logError` pero no impide avisar a los demás.
 */

import type { FakePlaylist } from '@/testing/mocks/expo-audio';
import { makeSong } from '@/testing/fixtures';
import type { PlaybackStatus } from '@/services/audio/native-playlist';

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
type Events = typeof import('@/services/audio/events');
type Native = typeof import('@/services/audio/native-playlist');
type Session = typeof import('@/services/audio/session');
type ErrorLog = typeof import('@/services/error-log.service');

let audio: AudioMock;
let events: Events;
let native: Native;
let session: Session;
let errorLog: ErrorLog;

function song(id: number): ReturnType<typeof makeSong> {
  return makeSong({ id, uri: `file:///music/${id}.mp3`, title: `Canción ${id}` });
}

function status(playing: boolean): PlaybackStatus {
  return {
    currentIndex: 0,
    playing,
    currentTime: 3,
    duration: 120,
    isBuffering: false,
  };
}

/** Lleva la sesión a `playing` por una ruta legal antes de emitir eventos. */
function toPlaying(): void {
  session.transitionTo('preparing');
  session.transitionTo('playing');
}

beforeEach(() => {
  jest.resetModules();
  audio = jest.requireMock<AudioMock>('expo-audio');
  audio.__reset();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  events = require('@/services/audio/events') as Events;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  native = require('@/services/audio/native-playlist') as Native;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  session = require('@/services/audio/session') as Session;
  errorLog = jest.requireMock<ErrorLog>('@/services/error-log.service');
});

afterEach(() => {
  native.disposePlaylist();
  session.resetSession();
});

describe('eventos del motor: ticks, pistas y sesión', () => {
  it('publica los ticks a los suscriptores y permite darse de baja', () => {
    const seen: PlaybackStatus[] = [];
    const unsubscribe = events.subscribePlaylistStatus((value) => seen.push(value));

    events.handleStatus(status(true));
    unsubscribe();
    events.handleStatus(status(false));

    expect(seen).toEqual([status(true)]);
  });

  it('sincroniza playing/paused solo cuando el tick contradice la sesión', () => {
    toPlaying();

    events.handleStatus(status(true));
    expect(session.getSession().state).toBe('playing');

    events.handleStatus(status(false));
    expect(session.getSession().state).toBe('paused');

    // Un tick repetido en `paused` no provoca otra transición.
    events.handleStatus(status(false));
    expect(session.getSession().state).toBe('paused');
  });

  it('los eventos nativos llegan a los oyentes con índices del orden completo', () => {
    const first = song(1);
    const second = song(2);
    const instance = native.createPlaylist(
      [first, second],
      'none',
      { onStatus: events.handleStatus, onTrack: events.handleTrack },
      0
    ) as unknown as FakePlaylist;
    const ticks: PlaybackStatus[] = [];
    const tracks: number[] = [];
    events.subscribePlaylistStatus((value) => ticks.push(value));
    events.subscribeTrackChange((value) => tracks.push(value.id));
    toPlaying();

    instance.__emit('playlistStatusUpdate', {
      currentIndex: 1,
      playing: false,
      currentTime: 12,
      duration: 180,
      isBuffering: false,
    });
    instance.__emit('trackChanged', { currentIndex: 1 });

    expect(ticks[0]).toMatchObject({ currentIndex: 1, playing: false, currentTime: 12 });
    expect(tracks).toEqual([2]);
    expect(session.getSession().state).toBe('paused');
  });

  it('handleTrack actualiza la notificación y avisa aunque un oyente falle', () => {
    const current = song(1);
    native.createPlaylist([current], 'none', { onStatus: jest.fn(), onTrack: jest.fn() }, 0);
    const seen: number[] = [];
    const broken = jest.fn(() => {
      throw new Error('oyente roto');
    });
    events.subscribeTrackChange(broken);
    events.subscribeTrackChange((value) => seen.push(value.id));

    expect(() => events.handleTrack(current)).not.toThrow();

    const instance = audio.__last();
    expect(instance?.updateLockScreenMetadata).toHaveBeenCalledWith({
      title: 'Canción 1',
      artist: 'Artista',
      albumTitle: 'Álbum',
      artworkUrl: undefined,
    });
    expect(broken).toHaveBeenCalledTimes(1);
    expect(seen).toEqual([1]);
    expect(errorLog.logError).toHaveBeenCalledWith(
      'audio/events',
      'trackListener',
      expect.any(Error)
    );
  });

  it('handleTrack sin playlist no lanza y solo avisa', () => {
    const seen: number[] = [];
    events.subscribeTrackChange((value) => seen.push(value.id));

    expect(() => events.handleTrack(song(7))).not.toThrow();
    expect(seen).toEqual([7]);
    expect(errorLog.logError).not.toHaveBeenCalled();
  });

  it('darse de baja de trackChanged evita nuevos avisos', () => {
    const seen: number[] = [];
    const unsubscribe = events.subscribeTrackChange((value) => seen.push(value.id));

    unsubscribe();
    events.handleTrack(song(3));

    expect(seen).toEqual([]);
  });

  it('advance ignora una transición inválida en vez de lanzar', () => {
    expect(session.getSession().state).toBe('idle');
    expect(session.canTransitionTo('playing')).toBe(false);

    expect(() => events.advance('playing')).not.toThrow();
    expect(session.getSession().state).toBe('idle');
    expect(errorLog.logError).not.toHaveBeenCalled();
  });
});
