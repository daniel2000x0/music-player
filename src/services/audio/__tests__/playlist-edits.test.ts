/**
 * Ediciones de la cola (`playlist-edits`).
 *
 * LÓGICA: las altas, inserciones y bajas se aplican al ORDEN COMPLETO y después
 * se vuelve a recortar la ventana nativa. Si no hay cola cargada no se toca
 * nada: la cola canónica vive en el store y se cargará en la primera acción.
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
type Edits = typeof import('@/services/audio/playlist-edits');
type Native = typeof import('@/services/audio/native-playlist');

let audio: AudioMock;
let edits: Edits;
let native: Native;

function library(count: number): Song[] {
  return Array.from({ length: count }, (_, index) =>
    makeSong({ id: index + 1, uri: `file:///music/${index + 1}.mp3` })
  );
}

function ids(songs: Song[]): number[] {
  return songs.map((song) => song.id);
}

/** Carga un orden en el motor sin arrancar la sesión de reproducción. */
function loadQueue(songs: Song[], startIndex = 0): FakePlaylist {
  const instance = native.createPlaylist(
    songs,
    'none',
    { onStatus: jest.fn(), onTrack: jest.fn() },
    startIndex
  );
  return instance as unknown as FakePlaylist;
}

beforeEach(() => {
  // El motor guarda el orden en variables de módulo: registro limpio por prueba.
  jest.resetModules();
  audio = jest.requireMock<AudioMock>('expo-audio');
  audio.__reset();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  edits = require('@/services/audio/playlist-edits') as Edits;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  native = require('@/services/audio/native-playlist') as Native;
});

afterEach(() => {
  native.disposePlaylist();
});

describe('ediciones de la cola: orden completo y ventana nativa', () => {
  it('sin cola no toca el orden ni crea una playlist', () => {
    const song = makeSong({ id: 99 });

    edits.appendToPlaylist(song);
    edits.insertAfterCurrent(song);
    edits.removeSongById(99);

    expect(native.getOrder()).toEqual([]);
    expect(native.hasQueue()).toBe(false);
    expect(audio.createAudioPlaylist).not.toHaveBeenCalled();
  });

  it('añade al final y conserva la pista actual', () => {
    loadQueue(library(3), 1);
    const added = makeSong({ id: 4, uri: 'file:///music/4.mp3' });

    edits.appendToPlaylist(added);

    expect(ids(native.getOrder())).toEqual([1, 2, 3, 4]);
    expect(native.getCurrentSong()?.id).toBe(2);
    expect(audio.__last()?.sources).toHaveLength(4);
  });

  it('inserta justo después de la actual', () => {
    loadQueue(library(4), 1);
    const inserted = makeSong({ id: 9, uri: 'file:///music/9.mp3' });

    edits.insertAfterCurrent(inserted);

    expect(ids(native.getOrder())).toEqual([1, 2, 9, 3, 4]);
    expect(native.getCurrentSong()?.id).toBe(2);
  });

  it('elimina por id y recorta la ventana', () => {
    const first = loadQueue(library(4), 2);

    edits.removeSongById(1);

    expect(ids(native.getOrder())).toEqual([2, 3, 4]);
    expect(native.getCurrentSong()?.id).toBe(3);
    expect(audio.__last()).not.toBe(first);
    expect(audio.__last()?.sources).toHaveLength(3);
  });

  it('no inserta ni elimina la pista actual', () => {
    loadQueue(library(3), 1);

    edits.insertAfterCurrent(makeSong({ id: 2 }));
    expect(ids(native.getOrder())).toEqual([1, 2, 3]);

    edits.removeSongById(2);
    expect(ids(native.getOrder())).toEqual([1, 2, 3]);
  });

  it('deduplica: insertar una pista ya presente la mueve, no la repite', () => {
    loadQueue(library(4), 1);

    // La pista 4 ya estaba al final: se extrae y se coloca tras la actual.
    edits.insertAfterCurrent(makeSong({ id: 4 }));

    expect(ids(native.getOrder())).toEqual([1, 2, 4, 3]);
    expect(native.getTrackCount()).toBe(4);
  });

  it('recompone una ventana acotada tras editar una cola larga', () => {
    const first = loadQueue(library(250), 110);
    expect(audio.__last()?.sources).toHaveLength(201);

    edits.appendToPlaylist(makeSong({ id: 999, uri: 'file:///music/999.mp3' }));

    const second = audio.__last();
    expect(second).not.toBe(first);
    expect(second?.sources).toHaveLength(201);
    expect(native.getTrackCount()).toBe(251);
    expect(native.getCurrentSong()?.id).toBe(111);
  });
});
