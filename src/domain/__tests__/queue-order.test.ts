/**
 * Orden de reproducción puro (`queue-order`).
 *
 * LÓGICA: sin aleatorio se devuelve una copia del orden; con aleatorio la pista
 * actual se coloca primero y el resto se baraja sin mutar la entrada. Comparar
 * por secuencia (no por conjunto) decide cuándo hay que reconstruir la playlist.
 */

import { buildPlaybackOrder, hasSamePlaybackOrder } from '@/domain/playback/queue-order';
import { makeSong } from '@/testing/fixtures';
import type { Song } from '@/types/song';

function library(count: number): Song[] {
  return Array.from({ length: count }, (_, index) => makeSong({ id: index + 1 }));
}

function ids(songs: Song[]): number[] {
  return songs.map((song) => song.id);
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('orden de reproducción', () => {
  it('sin aleatorio devuelve una copia del orden y no muta la entrada', () => {
    const songs = library(4);

    const result = buildPlaybackOrder(songs, 2, false);

    expect(result).toEqual(songs);
    expect(result).not.toBe(songs);
    expect(ids(songs)).toEqual([1, 2, 3, 4]);
  });

  it('con aleatorio pone la pista actual primero y conserva todas las pistas', () => {
    const songs = library(4);

    const result = buildPlaybackOrder(songs, 3, true);

    expect(result[0].id).toBe(3);
    expect(ids(result).slice().sort()).toEqual([1, 2, 3, 4]);
    expect(ids(songs)).toEqual([1, 2, 3, 4]);
  });

  it('baraja de forma determinista cuando Math.random es constante', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);

    const result = buildPlaybackOrder(library(4), 3, true);

    expect(ids(result)).toEqual([3, 2, 4, 1]);
  });

  it('con aleatorio y sin pista actual baraja todas las pistas', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);

    expect(ids(buildPlaybackOrder(library(3), null, true))).toEqual([2, 3, 1]);
  });

  it('una cola vacía produce un orden vacío en cualquier modo', () => {
    expect(buildPlaybackOrder([], null, false)).toEqual([]);
    expect(buildPlaybackOrder([], 1, true)).toEqual([]);
  });
});

describe('comparación de órdenes', () => {
  it('considera iguales las secuencias con los mismos ids', () => {
    expect(hasSamePlaybackOrder(library(4), library(4))).toBe(true);
  });

  it('detecta distinto orden aunque el conjunto de pistas sea el mismo', () => {
    expect(hasSamePlaybackOrder(library(4), library(4).reverse())).toBe(false);
  });

  it('detecta distinta longitud y cambios de id', () => {
    expect(hasSamePlaybackOrder(library(4), library(5))).toBe(false);
    expect(hasSamePlaybackOrder(library(3), [makeSong({ id: 1 }), makeSong({ id: 2 }), makeSong({ id: 9 })])).toBe(
      false
    );
  });

  it('compara colas vacías como iguales', () => {
    expect(hasSamePlaybackOrder([], [])).toBe(true);
  });
});
