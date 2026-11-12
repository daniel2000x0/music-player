import {
  resolveSongsByIds,
  songsOfAlbum,
  songsOfArtist,
} from '@/domain/library/selection';

import { makeSong } from '@/testing/fixtures';

const songs = [
  makeSong({ id: 1, title: 'Uno', artist: 'Ana', album: 'A' }),
  makeSong({ id: 2, title: 'Dos', artist: 'Beto', album: 'B' }),
  makeSong({ id: 3, title: 'Tres', artist: 'Ana', album: 'B' }),
  makeSong({ id: 4, title: 'Cuatro', artist: 'Ana', album: 'A' }),
];

describe('resolveSongsByIds', () => {
  it('respeta el orden pedido', () => {
    expect(resolveSongsByIds(songs, [3, 1, 2]).map((song) => song.id)).toEqual([3, 1, 2]);
  });

  it('descarta ids inexistentes y no muta la lista original', () => {
    expect(resolveSongsByIds(songs, [9, 2]).map((song) => song.id)).toEqual([2]);
    expect(songs).toHaveLength(4);
  });

  it('devuelve una lista vacía sin ids', () => {
    expect(resolveSongsByIds(songs, [])).toEqual([]);
  });
});

describe('songsOfAlbum', () => {
  it('filtra por título y artista del álbum', () => {
    const result = songsOfAlbum(songs, { title: 'A', artist: 'Ana' });
    expect(result.map((song) => song.id)).toEqual([1, 4]);
  });

  it('no mezcla álbumes homónimos de artistas distintos', () => {
    const result = songsOfAlbum(songs, { title: 'B', artist: 'Ana' });
    expect(result.map((song) => song.id)).toEqual([3]);
  });

  it('devuelve una lista vacía si no hay coincidencias', () => {
    expect(songsOfAlbum(songs, { title: 'Z', artist: 'Ana' })).toEqual([]);
  });
});

describe('songsOfArtist', () => {
  it('devuelve las canciones del artista en el orden original', () => {
    expect(songsOfArtist(songs, 'Ana').map((song) => song.id)).toEqual([1, 3, 4]);
  });

  it('devuelve una lista vacía si el artista no existe', () => {
    expect(songsOfArtist(songs, 'Nadie')).toEqual([]);
  });
});
