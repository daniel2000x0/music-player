import {
  sortAlbums,
  sortArtists,
  sortDirectionOf,
  sortFieldOf,
  sortSongs,
  toggleSortDirection,
} from '@/domain/library/sorting';
import type { Album, Artist } from '@/types/song';

import { makeSong } from '@/testing/fixtures';

describe('claves de orden', () => {
  it('extrae el campo y la dirección de una clave', () => {
    expect(sortFieldOf('title-asc')).toBe('title');
    expect(sortDirectionOf('title-asc')).toBe('asc');
    expect(sortFieldOf('duration-desc')).toBe('duration');
    expect(sortDirectionOf('duration-desc')).toBe('desc');
    expect(sortFieldOf('lastPlayed-desc')).toBe('lastPlayed');
  });

  it('alterna la dirección conservando el campo', () => {
    expect(toggleSortDirection('title-asc')).toBe('title-desc');
    expect(toggleSortDirection('title-desc')).toBe('title-asc');
    expect(toggleSortDirection('lastPlayed-desc')).toBe('lastPlayed-asc');
    expect(toggleSortDirection('plays-desc')).toBe('plays-asc');
  });
});

describe('sortSongs', () => {
  const songs = [
    makeSong({ id: 1, title: 'Canción 10', duration: 200, playCount: 1, lastPlayedAt: null }),
    makeSong({ id: 2, title: 'Canción 2', duration: 100, playCount: 5, lastPlayedAt: 50 }),
    makeSong({ id: 3, title: 'Otra', duration: 300, playCount: 0, lastPlayedAt: 99 }),
  ];

  it('ordena por título con números naturales', () => {
    expect(sortSongs(songs, 'title-asc').map((song) => song.id)).toEqual([2, 1, 3]);
  });

  it('ordena por duración y reproducciones descendente', () => {
    expect(sortSongs(songs, 'duration-desc').map((song) => song.id)).toEqual([3, 1, 2]);
    expect(sortSongs(songs, 'plays-desc').map((song) => song.id)).toEqual([2, 1, 3]);
  });

  it('trata lastPlayedAt nulo como 0', () => {
    expect(sortSongs(songs, 'lastPlayed-desc').map((song) => song.id)).toEqual([3, 2, 1]);
  });

  it('no muta la lista original', () => {
    const copy = [...songs];
    sortSongs(songs, 'title-desc');
    expect(songs).toEqual(copy);
  });
});

describe('sortAlbums y sortArtists', () => {
  const albums: Album[] = [
    { id: 1, title: 'Zeta', artist: 'Ana', artwork: null, songCount: 2, totalDuration: 400, createdAt: 1 },
    { id: 2, title: 'Alfa', artist: 'Beto', artwork: null, songCount: 5, totalDuration: 100, createdAt: 2 },
  ];

  const artists: Artist[] = [
    { id: 1, name: 'Zoe', songCount: 2, albumCount: 1, lastPlayedAt: null },
    { id: 2, name: 'Ana', songCount: 5, albumCount: 2, lastPlayedAt: 10 },
  ];

  it('ordena álbumes por título y cantidad de canciones', () => {
    expect(sortAlbums(albums, 'title-asc').map((album) => album.id)).toEqual([2, 1]);
    expect(sortAlbums(albums, 'songs-desc').map((album) => album.id)).toEqual([2, 1]);
    expect(sortAlbums(albums, 'duration-asc').map((album) => album.id)).toEqual([2, 1]);
  });

  it('ordena artistas por nombre y última reproducción', () => {
    expect(sortArtists(artists, 'name-asc').map((artist) => artist.id)).toEqual([2, 1]);
    expect(sortArtists(artists, 'lastPlayed-desc').map((artist) => artist.id)).toEqual([2, 1]);
  });
});
