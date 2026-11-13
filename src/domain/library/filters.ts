import type { SongFilter } from '@/types/filters';
import type { Song } from '@/types/song';

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Aplica filtros combinables sobre una lista de canciones.
 * Función pura: no modifica la lista original.
 *
 * RENDIMIENTO: las condiciones se resuelven una sola vez fuera del recorrido
 * y la búsqueda se compara contra cada campo por separado (sin concatenar
 * cadenas por canción, que era más lento con bibliotecas grandes).
 */
export function filterSongs(
  songs: Song[],
  filter: SongFilter,
  favoriteIds: ReadonlySet<number>
): Song[] {
  const query = normalize(filter.query ?? '');
  const view = filter.view ?? 'all';

  const artist = filter.artist || null;
  const album = filter.album || null;
  const minDuration =
    typeof filter.minDuration === 'number' ? filter.minDuration : null;
  const maxDuration =
    typeof filter.maxDuration === 'number' ? filter.maxDuration : null;

  return songs.filter((song) => {
    if (!song.isAvailable) {
      return false;
    }
    // Los audiolibros viven en su propia pestaña: nunca en Canciones.
    if (song.isAudiobook) {
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
    if (artist !== null && song.artist !== artist) {
      return false;
    }
    if (album !== null && song.album !== album) {
      return false;
    }
    if (minDuration !== null && song.duration < minDuration) {
      return false;
    }
    if (maxDuration !== null && song.duration > maxDuration) {
      return false;
    }
    if (query) {
      const matches =
        song.title.toLowerCase().includes(query) ||
        song.artist.toLowerCase().includes(query) ||
        song.album.toLowerCase().includes(query);

      if (!matches) {
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
