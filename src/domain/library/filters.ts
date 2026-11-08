import type { SongFilter } from '@/types/filters';
import type { Song } from '@/types/song';

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Aplica filtros combinables sobre una lista de canciones.
 * Función pura: no modifica la lista original.
 */
export function filterSongs(
  songs: Song[],
  filter: SongFilter,
  favoriteIds: ReadonlySet<number>
): Song[] {
  const query = filter.query ? normalize(filter.query) : '';
  const view = filter.view ?? 'all';

  return songs.filter((song) => {
    if (!song.isAvailable) {
      return false;
    }
    if (view === 'favorites' && !favoriteIds.has(song.id)) {
      return false;
    }
    if (view === 'played' && song.playCount <= 0) {
      return false;
    }
    if (view === 'unplayed' && song.playCount > 0) {
      return false;
    }
    if (filter.artist && song.artist !== filter.artist) {
      return false;
    }
    if (filter.album && song.album !== filter.album) {
      return false;
    }
    if (typeof filter.minDuration === 'number' && song.duration < filter.minDuration) {
      return false;
    }
    if (typeof filter.maxDuration === 'number' && song.duration > filter.maxDuration) {
      return false;
    }
    if (query) {
      const haystack = `${song.title} ${song.artist} ${song.album}`.toLowerCase();
      if (!haystack.includes(query)) {
        return false;
      }
    }
    return true;
  });
}

export function hasActiveFilters(filter: SongFilter): boolean {
  return Boolean(
    filter.query ||
      (filter.view && filter.view !== 'all') ||
      filter.artist ||
      filter.album ||
      typeof filter.minDuration === 'number' ||
      typeof filter.maxDuration === 'number'
  );
}
