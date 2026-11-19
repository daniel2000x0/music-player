import {
  sortAlbums,
  sortArtists,
  sortDirectionOf,
  sortFieldOf,
  sortPlaylists,
  sortSongs,
  toggleSortDirection,
} from '@/domain/library/sorting';
import type {
  AlbumSortKey,
  ArtistSortKey,
  PlaylistSortKey,
  SongSortKey,
} from '@/types/filters';
import type { Playlist } from '@/types/playlist';
import type { Album, Artist } from '@/types/song';

import { makeSong } from '@/testing/fixtures';

/**
 * Las claves de orden son cadenas `campo-dirección`. Se comprueban tanto la
 * extracción como el alternado, incluida la dirección por defecto (`desc`)
 * cuando la clave no termina en `-asc`.
 */
describe('claves de orden', () => {
  it('extrae el campo y la dirección de una clave', () => {
    expect(sortFieldOf('title-asc')).toBe('title');
    expect(sortDirectionOf('title-asc')).toBe('asc');
    expect(sortFieldOf('duration-desc')).toBe('duration');
    expect(sortDirectionOf('duration-desc')).toBe('desc');
    expect(sortFieldOf('lastPlayed-desc')).toBe('lastPlayed');
    expect(sortDirectionOf('otra-cosa')).toBe('desc');
  });

  it('alterna la dirección conservando el campo', () => {
    expect(toggleSortDirection('title-asc')).toBe('title-desc');
    expect(toggleSortDirection('title-desc')).toBe('title-asc');
    expect(toggleSortDirection('lastPlayed-desc')).toBe('lastPlayed-asc');
    expect(toggleSortDirection('plays-desc')).toBe('plays-asc');
  });
});

describe('sortSongs', () => {
  /** Tres pistas con todos los criterios distintos para identificar cada rama. */
  const songs = [
    makeSong({
      id: 1,
      title: 'Canción 10',
      artist: 'Zoe',
      album: 'Zeta',
      duration: 200,
      playCount: 1,
      lastPlayedAt: null,
      addedAt: 300,
    }),
    makeSong({
      id: 2,
      title: 'Canción 2',
      artist: 'Ana',
      album: 'Alfa',
      duration: 100,
      playCount: 5,
      lastPlayedAt: 50,
      addedAt: 100,
    }),
    makeSong({
      id: 3,
      title: 'Otra',
      artist: 'Ana',
      album: 'Alfa',
      duration: 300,
      playCount: 0,
      lastPlayedAt: 99,
      addedAt: 200,
    }),
  ];

  const ids = (key: SongSortKey): number[] => sortSongs(songs, key).map((song) => song.id);

  it('ordena por título con números naturales en ambos sentidos', () => {
    expect(ids('title-asc')).toEqual([2, 1, 3]);
    expect(ids('title-desc')).toEqual([3, 1, 2]);
  });

  it('ordena por artista y desempata por título en ambos sentidos', () => {
    expect(ids('artist-asc')).toEqual([2, 3, 1]);
    expect(ids('artist-desc')).toEqual([1, 2, 3]);
  });

  it('ordena por álbum y desempata por título en ambos sentidos', () => {
    expect(ids('album-asc')).toEqual([2, 3, 1]);
    expect(ids('album-desc')).toEqual([1, 2, 3]);
  });

  it('ordena por duración y reproducciones en ambos sentidos', () => {
    expect(ids('duration-asc')).toEqual([2, 1, 3]);
    expect(ids('duration-desc')).toEqual([3, 1, 2]);
    expect(ids('plays-asc')).toEqual([3, 1, 2]);
    expect(ids('plays-desc')).toEqual([2, 1, 3]);
  });

  it('ordena por fecha de adición en ambos sentidos', () => {
    expect(ids('added-asc')).toEqual([2, 3, 1]);
    expect(ids('added-desc')).toEqual([1, 3, 2]);
  });

  it('trata lastPlayedAt nulo como 0 en ambos sentidos', () => {
    expect(ids('lastPlayed-asc')).toEqual([1, 2, 3]);
    expect(ids('lastPlayed-desc')).toEqual([3, 2, 1]);
  });

  it('devuelve la copia sin ordenar ante una clave desconocida', () => {
    expect(sortSongs(songs, 'desconocida' as SongSortKey).map((song) => song.id)).toEqual([
      1, 2, 3,
    ]);
  });

  it('no muta la lista original', () => {
    const copy = [...songs];
    sortSongs(songs, 'title-desc');
    expect(songs).toEqual(copy);
  });
});

describe('sortAlbums', () => {
  const albums: Album[] = [
    { id: 1, title: 'Zeta', artist: 'Ana', artwork: null, songCount: 2, totalDuration: 400, createdAt: 1 },
    { id: 2, title: 'Alfa', artist: 'Beto', artwork: null, songCount: 5, totalDuration: 100, createdAt: 2 },
  ];

  const ids = (key: AlbumSortKey): number[] => sortAlbums(albums, key).map((album) => album.id);

  it('ordena por título y artista con desempate', () => {
    expect(ids('title-asc')).toEqual([2, 1]);
    expect(ids('title-desc')).toEqual([1, 2]);
    expect(ids('artist-asc')).toEqual([1, 2]);
    expect(ids('artist-desc')).toEqual([2, 1]);
  });

  it('ordena por fecha, cantidad de canciones y duración en ambos sentidos', () => {
    expect(ids('added-asc')).toEqual([1, 2]);
    expect(ids('added-desc')).toEqual([2, 1]);
    expect(ids('songs-asc')).toEqual([1, 2]);
    expect(ids('songs-desc')).toEqual([2, 1]);
    expect(ids('duration-asc')).toEqual([2, 1]);
    expect(ids('duration-desc')).toEqual([1, 2]);
  });

  it('devuelve la copia sin ordenar ante una clave desconocida', () => {
    expect(sortAlbums(albums, 'desconocida' as AlbumSortKey).map((album) => album.id)).toEqual([
      1, 2,
    ]);
  });
});

describe('sortArtists', () => {
  const artists: Artist[] = [
    { id: 1, name: 'Zoe', songCount: 2, albumCount: 1, lastPlayedAt: null },
    { id: 2, name: 'Ana', songCount: 5, albumCount: 2, lastPlayedAt: 10 },
  ];

  const ids = (key: ArtistSortKey): number[] => sortArtists(artists, key).map((artist) => artist.id);

  it('ordena por nombre en ambos sentidos', () => {
    expect(ids('name-asc')).toEqual([2, 1]);
    expect(ids('name-desc')).toEqual([1, 2]);
  });

  it('ordena por canciones y álbumes en ambos sentidos', () => {
    expect(ids('songs-asc')).toEqual([1, 2]);
    expect(ids('songs-desc')).toEqual([2, 1]);
    expect(ids('albums-asc')).toEqual([1, 2]);
    expect(ids('albums-desc')).toEqual([2, 1]);
  });

  it('trata lastPlayedAt nulo como 0 en ambos sentidos', () => {
    expect(ids('lastPlayed-asc')).toEqual([1, 2]);
    expect(ids('lastPlayed-desc')).toEqual([2, 1]);
  });

  it('devuelve la copia sin ordenar ante una clave desconocida', () => {
    expect(sortArtists(artists, 'desconocida' as ArtistSortKey).map((artist) => artist.id)).toEqual([
      1, 2,
    ]);
  });
});

describe('sortPlaylists', () => {
  const playlists: Playlist[] = [
    { id: 1, name: 'Zeta', isAuto: false, autoKey: null, songIds: [1, 2, 3], createdAt: 1, updatedAt: 1 },
    { id: 2, name: 'Alfa', isAuto: false, autoKey: null, songIds: [1], createdAt: 2, updatedAt: 2 },
  ];

  const ids = (key: PlaylistSortKey): number[] =>
    sortPlaylists(playlists, key).map((playlist) => playlist.id);

  it('ordena por nombre en ambos sentidos', () => {
    expect(ids('name-asc')).toEqual([2, 1]);
    expect(ids('name-desc')).toEqual([1, 2]);
  });

  it('ordena por fecha y cantidad de canciones en ambos sentidos', () => {
    expect(ids('created-asc')).toEqual([1, 2]);
    expect(ids('created-desc')).toEqual([2, 1]);
    expect(ids('songs-asc')).toEqual([2, 1]);
    expect(ids('songs-desc')).toEqual([1, 2]);
  });

  it('devuelve la copia sin ordenar ante una clave desconocida', () => {
    expect(
      sortPlaylists(playlists, 'desconocida' as PlaylistSortKey).map((playlist) => playlist.id)
    ).toEqual([1, 2]);
  });
});
