import { filterSongs, hasActiveFilters } from '@/domain/library/filters';

import { makeSong } from '@/testing/fixtures';

const songs = [
  makeSong({ id: 1, title: 'Uno', artist: 'Ana', album: 'A', duration: 100 }),
  makeSong({ id: 2, title: 'Dos', artist: 'Beto', album: 'B', duration: 200, playCount: 3 }),
  makeSong({ id: 3, title: 'Tres', artist: 'Ana', album: 'B', duration: 300, playCount: 1 }),
  makeSong({ id: 4, title: 'Cuatro', artist: 'Caro', album: 'C', isAvailable: false }),
];

const favorites = new Set<number>([1, 3]);

describe('filterSongs', () => {
  it('excluye canciones no disponibles siempre', () => {
    const result = filterSongs(songs, {}, favorites);
    expect(result.map((song) => song.id)).toEqual([1, 2, 3]);
  });

  it('filtra por favoritos', () => {
    const result = filterSongs(songs, { view: 'favorites' }, favorites);
    expect(result.map((song) => song.id)).toEqual([1, 3]);
  });

  it('separa reproducidas y sin reproducir', () => {
    expect(filterSongs(songs, { view: 'played' }, favorites).map((song) => song.id)).toEqual([2, 3]);
    expect(filterSongs(songs, { view: 'unplayed' }, favorites).map((song) => song.id)).toEqual([1]);
  });

  it('combina búsqueda, artista y álbum', () => {
    const result = filterSongs(songs, { query: 'tres', artist: 'Ana', album: 'B' }, favorites);
    expect(result.map((song) => song.id)).toEqual([3]);
  });

  it('filtra por rango de duración', () => {
    const result = filterSongs(songs, { minDuration: 150, maxDuration: 250 }, favorites);
    expect(result.map((song) => song.id)).toEqual([2]);
  });

  it('no muta la lista original', () => {
    const copy = [...songs];
    filterSongs(songs, { view: 'played' }, favorites);
    expect(songs).toEqual(copy);
  });
});

describe('hasActiveFilters', () => {
  it('detecta filtros activos', () => {
    expect(hasActiveFilters({})).toBe(false);
    expect(hasActiveFilters({ view: 'all' })).toBe(false);
    expect(hasActiveFilters({ view: 'favorites' })).toBe(true);
    expect(hasActiveFilters({ query: 'hola' })).toBe(true);
    expect(hasActiveFilters({ minDuration: 0 })).toBe(true);
  });
});
