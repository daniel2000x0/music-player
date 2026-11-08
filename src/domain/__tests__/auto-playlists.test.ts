import { AUTO_PLAYLISTS, getAutoPlaylistSongs } from '@/domain/library/auto-playlists';

import { makeSong } from '@/testing/fixtures';

const songs = [
  makeSong({ id: 1, addedAt: 30, playCount: 2, lastPlayedAt: 10 }),
  makeSong({ id: 2, addedAt: 10, playCount: 8, lastPlayedAt: 20 }),
  makeSong({ id: 3, addedAt: 20, playCount: 0 }),
  makeSong({ id: 4, addedAt: 40, isAvailable: false }),
];

const favorites = new Set<number>([1, 3]);
const recentIds = [3, 1];

describe('AUTO_PLAYLISTS', () => {
  it('define las seis listas automáticas sin duplicados', () => {
    const keys = AUTO_PLAYLISTS.map((item) => item.key);
    expect(keys).toHaveLength(6);
    expect(new Set(keys).size).toBe(6);
  });
});

describe('getAutoPlaylistSongs', () => {
  it('ordena las más escuchadas y excluye no disponibles', () => {
    const result = getAutoPlaylistSongs('mostPlayed', songs, favorites, recentIds);
    expect(result.map((song) => song.id)).toEqual([2, 1]);
  });

  it('devuelve favoritos', () => {
    const result = getAutoPlaylistSongs('favorites', songs, favorites, recentIds);
    expect(result.map((song) => song.id)).toEqual([1, 3]);
  });

  it('respeta el orden del historial reciente', () => {
    const result = getAutoPlaylistSongs('recent', songs, favorites, recentIds);
    expect(result.map((song) => song.id)).toEqual([3, 1]);
  });

  it('ordena por fecha de incorporación y filtra sin reproducir', () => {
    expect(
      getAutoPlaylistSongs('recentlyAdded', songs, favorites, recentIds).map((song) => song.id)
    ).toEqual([1, 3, 2]);
    expect(
      getAutoPlaylistSongs('unplayed', songs, favorites, recentIds).map((song) => song.id)
    ).toEqual([3]);
  });

  it('genera una permutación completa en aleatoria', () => {
    const result = getAutoPlaylistSongs('random', songs, favorites, recentIds);
    expect(result.map((song) => song.id).sort()).toEqual([1, 2, 3]);
  });
});
