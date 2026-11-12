import {
  hasAudiobookKeyword,
  isGenericFolder,
  looksLikeChapter,
  UNKNOWN_ALBUM,
  UNKNOWN_ARTIST,
  UNKNOWN_AUTHOR,
} from '@/domain/metadata';
import type { Album, Song } from '@/types/song';

/**
 * Clasificación de audiolibros.
 *
 * LÓGICA: el estado efectivo vive en `songs.is_audiobook` (SQLite):
 * `true` → oculto de Canciones y agrupado en la pestaña Audiolibros.
 *
 * - `detectAudiobookSongIds`: heurística del escaneo (contenido largo,
 *   palabras clave, `.m4b` o capítulos numerados) — solo se aplica a
 *   canciones sin decisión manual del usuario (`audiobook_manual = 0`).
 * - `collectAudiobooks`: agrupa las canciones ya marcadas para la
 *   pestaña Audiolibros, con sus capítulos ordenados por número de pista.
 */

/** Duración media (s) por capítulo que indica una serie larga. */
export const AUDIOBOOK_AVG_DURATION = 10 * 60;

/** Duración (s) de una pista suelta que ya cuenta como audiolibro. */
export const AUDIOBOOK_SINGLE_DURATION = 20 * 60;

/** Duración total (s) de una serie de capítulos cortos. */
export const AUDIOBOOK_SERIES_TOTAL = 30 * 60;

/** Duración media (s) mínima para una serie de capítulos cortos. */
export const AUDIOBOOK_SHORT_AVG = 5 * 60;

/** Título que se muestra cuando no hay álbum ni carpeta útil. */
export const UNTITLED_AUDIOBOOK = 'Audiolibros sin álbum';

const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true });

/** Un audiolibro agrupado: sus capítulos y agregados calculados. */
export type Audiobook = {
  /** Clave estable del grupo (álbum/carpeta + autor). */
  key: string;
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
  title: string;
  uri: string;
  folder: string | null;
  duration: number;
};

/**
 * Clave de agrupación de un audiolibro.
 *
 * PRIORIDAD: álbum del tag; si no hay, la carpeta (permite separar libros
 * sueltos en carpetas distintas). El autor forma parte de la clave para no
 * fusionar dos libros del mismo título.
 */
export function audiobookBookKey(
  album: string,
  artist: string,
  folder: string | null
): string {
  const book = album !== UNKNOWN_ALBUM ? album : folder ?? UNKNOWN_ALBUM;
  return `${book}\u0000${artist}`;
}

function isM4b(uri: string): boolean {
  const clean = uri.split('?')[0].toLowerCase();
  return clean.endsWith('.m4b');
}

/**
 * Heurística de detección: ids de canciones que forman un audiolibro.
 *
 * Califica un grupo si:
 * - el nombre/álbum/carpeta delata un audiolibro o es un `.m4b`;
 * - es una serie de 2+ pistas con duración media larga;
 * - es una pista suelta de larga duración;
 * - es una serie de capítulos cortos reconocibles por su título.
 */
export function detectAudiobookSongIds(songs: readonly AudiobookCandidate[]): Set<number> {
  const groups = new Map<
    string,
    {
      artist: string;
      album: string;
      folder: string | null;
      ids: number[];
      titles: string[];
      uris: string[];
      total: number;
    }
  >();

  for (const song of songs) {
    const key = audiobookBookKey(song.album, song.artist, song.folder);
    const bucket = groups.get(key);
    if (bucket) {
      bucket.ids.push(song.id);
      bucket.titles.push(song.title);
      bucket.uris.push(song.uri);
      bucket.total += song.duration;
    } else {
      groups.set(key, {
        artist: song.artist,
        album: song.album,
        folder: song.folder,
        ids: [song.id],
        titles: [song.title],
        uris: [song.uri],
        total: song.duration,
      });
    }
  }

  const detected = new Set<number>();
  for (const group of groups.values()) {
    const count = group.ids.length;
    const average = group.total / count;
    const keyword = hasAudiobookKeyword(group.album, group.artist, group.folder, ...group.titles);
    const m4b = group.uris.some(isM4b);
    const chapterSeries =
      count >= 2 &&
      group.total >= AUDIOBOOK_SERIES_TOTAL &&
      average >= AUDIOBOOK_SHORT_AVG &&
      group.titles.every(looksLikeChapter);

    const isBook =
      keyword ||
      m4b ||
      (count >= 2 && average >= AUDIOBOOK_AVG_DURATION) ||
      (count === 1 && group.total >= AUDIOBOOK_SINGLE_DURATION) ||
      chapterSeries;

    if (isBook) {
      for (const id of group.ids) {
        detected.add(id);
      }
    }
  }
  return detected;
}

/** Título visible del libro: álbum, carpeta o etiqueta genérica. */
function displayTitle(album: string, folder: string | null): string {
  if (album !== UNKNOWN_ALBUM) {
    return album;
  }
  if (folder && !isGenericFolder(folder)) {
    return folder;
  }
  return UNTITLED_AUDIOBOOK;
}

/** Capítulos en orden narrativo: número de pista y, si falta, título. */
function sortChapters(chapters: Song[]): Song[] {
  return [...chapters].sort((a, b) => {
    if (a.track !== null && b.track !== null) {
      if (a.track !== b.track) {
        return a.track - b.track;
      }
    } else if (a.track !== null) {
      return -1;
    } else if (b.track !== null) {
      return 1;
    }
    return collator.compare(a.title, b.title);
  });
}

/**
 * Agrupa las canciones marcadas como audiolibro (`isAudiobook`) por
 * libro y autor, con capítulos ordenados por número de pista.
 */
export function collectAudiobooks(songs: Song[], albums: Album[]): Audiobook[] {
  const groups = new Map<string, Song[]>();

  for (const song of songs) {
    if (!song.isAvailable || !song.isAudiobook) {
      continue;
    }
    const key = audiobookBookKey(song.album, song.artist, song.folder);
    const bucket = groups.get(key);
    if (bucket) {
      bucket.push(song);
    } else {
      groups.set(key, [song]);
    }
  }

  const books: Audiobook[] = [];
  for (const [key, chapters] of groups) {
    const first = chapters[0];
    const album = albums.find(
      (item) => item.title === first.album && item.artist === first.artist
    );
    books.push({
      key,
      albumId: album ? album.id : null,
      title: displayTitle(first.album, first.folder),
      author: first.artist === UNKNOWN_ARTIST ? UNKNOWN_AUTHOR : first.artist,
      chapters: sortChapters(chapters),
      totalDuration: chapters.reduce((sum, song) => sum + song.duration, 0),
    });
  }

  return books.sort((a, b) => collator.compare(a.title, b.title));
}
