import { sortSongs } from '@/domain/library/sorting';
import type { Album, Song } from '@/types/song';

/**
 * Clasificación de audiolibros.
 *
 * LÓGICA: el estado efectivo vive en `songs.is_audiobook` (SQLite):
 * `true` → oculto de Canciones y agrupado en la pestaña Audiolibros.
 *
 * - `detectAudiobookSongIds`: heurística del escaneo (contenido largo o
 *   carpetas etiquetadas como audiolibro) — solo se aplica a canciones
 *   sin decisión manual del usuario (`audiobook_manual = 0`).
 * - `collectAudiobooks`: agrupa las canciones ya marcadas para la
 *   pestaña Audiolibros, con sus capítulos ordenados por título.
 */

/** Duración media (s) por capítulo que indica una serie larga. */
export const AUDIOBOOK_AVG_DURATION = 10 * 60;

/** Duración (s) de una pista suelta que ya cuenta como audiolibro. */
export const AUDIOBOOK_SINGLE_DURATION = 20 * 60;

const AUDIOBOOK_KEYWORDS = ['audiolibro', 'audiobook', 'audible'] as const;

/** Un audiolibro agrupado: sus capítulos y agregados calculados. */
export type Audiobook = {
  /** Id del álbum en SQLite para navegar al detalle (null si no existe). */
  albumId: number | null;
  title: string;
  author: string;
  chapters: Song[];
  totalDuration: number;
};

/** Datos mínimos que la heurística necesita de cada canción escaneada. */
export type AudiobookCandidate = {
  id: number;
  album: string;
  artist: string;
  duration: number;
};

function hasKeyword(...values: string[]): boolean {
  const haystack = values.join(' ').toLowerCase();
  return AUDIOBOOK_KEYWORDS.some((keyword) => haystack.includes(keyword));
}

/**
 * Heurística de detección: ids de canciones que forman un audiolibro.
 * Un álbum califica si alguna pista delata la palabra clave, si es una
 * serie de 2+ pistas con duración media larga o si es una pista suelta
 * de larga duración.
 */
export function detectAudiobookSongIds(songs: readonly AudiobookCandidate[]): Set<number> {
  const groups = new Map<string, { artist: string; album: string; ids: number[]; total: number }>();

  for (const song of songs) {
    const key = `${song.album}\u0000${song.artist}`;
    const bucket = groups.get(key);
    if (bucket) {
      bucket.ids.push(song.id);
      bucket.total += song.duration;
    } else {
      groups.set(key, { album: song.album, artist: song.artist, ids: [song.id], total: song.duration });
    }
  }

  const detected = new Set<number>();
  for (const group of groups.values()) {
    const average = group.total / group.ids.length;
    const isBook =
      hasKeyword(group.artist, group.album) ||
      (group.ids.length >= 2 && average >= AUDIOBOOK_AVG_DURATION) ||
      (group.ids.length === 1 && group.total >= AUDIOBOOK_SINGLE_DURATION);
    if (isBook) {
      for (const id of group.ids) {
        detected.add(id);
      }
    }
  }
  return detected;
}

/**
 * Agrupa las canciones marcadas como audiolibro (`isAudiobook`) por
 * álbum y autor, con capítulos ordenados numéricamente por título.
 */
export function collectAudiobooks(songs: Song[], albums: Album[]): Audiobook[] {
  const groups = new Map<string, Song[]>();

  for (const song of songs) {
    if (!song.isAvailable || !song.isAudiobook) {
      continue;
    }
    const key = `${song.album}\u0000${song.artist}`;
    const bucket = groups.get(key);
    if (bucket) {
      bucket.push(song);
    } else {
      groups.set(key, [song]);
    }
  }

  const books: Audiobook[] = [];
  for (const [key, chapters] of groups) {
    const [albumTitle, artist] = key.split('\u0000');
    const album = albums.find(
      (item) => item.title === albumTitle && item.artist === artist
    );
    books.push({
      albumId: album ? album.id : null,
      title: albumTitle,
      author: artist,
      chapters: sortSongs(chapters, 'title-asc'),
      totalDuration: chapters.reduce((sum, song) => sum + song.duration, 0),
    });
  }

  return books.sort((a, b) => a.title.localeCompare(b.title));
}
